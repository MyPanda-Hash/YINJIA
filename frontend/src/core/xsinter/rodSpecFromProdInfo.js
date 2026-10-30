/**
 * rodSpecFromProdInfo.js —— 产品信息表参照行 → X烧结的「炭棒规格」三格  2026-10-30
 *
 * 【为什么需要它】
 *   用户报障「炭棒规格没带全」：外径 33 / 内径 12 出来了，**长度那格是空的**。
 *   链路本身的机制是后端 `PanelConfigService.buildRefMap` 按 **label 同名 + REF_SYNONYMS** 生成映射，
 *   前端照 `{from, to}` 直接 `head[to] = source[from]` —— 于是能不能带出**完全取决于参照行里
 *   有没有那个键**。实测产品信息表这几种情况都会漏：
 *     · 参照弹窗的列配置只回了部分字段（列清单由 core/ref/refColumns.js 决定，不是全字段）；
 *     · 老单据只填了「炭棒尺寸」/「产品整体尺寸」整串，三个独立列是空的。
 *   所以这里做**三层兜底**，且每一层都只补"还空着的那一格"。
 *
 * 【三层取值，优先级从高到低】
 *   ① 独立字段：炭棒外径 / 炭棒内径 / 炭棒长度（产品信息表的真源，2026-10-14 实测该三列才是准的）
 *   ② 参照行里改过名的键：炭棒出货长度（本面板自己的叫法）
 *   ③ 整串解析：「炭棒尺寸」→ 退「产品整体尺寸」，用与规格书同一个解析器
 *      （parseRodSizeRequirement："外径 33mm ±0.5 / 内径 12mm ±0.3 / 长度 110mm ±0.5"）
 *
 * 【绝不做什么】
 *   · 不返回空值 —— 空键不出现，调用方直接按条目写 head，纸上已填的内容不会被清掉；
 *   · 不覆盖已有值 —— 判断"还空着"由调用方传 current 进来（见 missingOnly）。
 */
import { parseRodSizeRequirement } from '../insp/dimensionSpec.js'

const textOf = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * @param {object|null} source  产品信息表的参照行（键 = 产品信息表的字段 label）
 * @param {object} [current]    本单据**当前**头数据（用来判断哪几格还空着；省略 = 只按 source 出值）
 * @returns {Record<string,string>} 只含**需要写入**的格：{ 炭棒外径?, 炭棒内径?, 炭棒出货长度? }
 */
export function rodSpecFromProdInfo(source, current = null) {
  const out = {}
  if (!source) return out
  const cur = current || {}
  // 该格需要补：**当前单据上还空着** 且 **本轮还没写进去** ——
  // 少了后半个条件，第 ③ 层的整串回退会把第 ① 层刚取到的独立字段覆盖掉（单测 ③ 抓到的）。
  const need = (k) => !textOf(cur[k]) && !textOf(out[k])
  const put = (k, v) => {
    if (!need(k)) return
    const t = textOf(v)
    if (t) out[k] = t
  }

  // ① 独立字段
  put('炭棒外径', source['炭棒外径'])
  put('炭棒内径', source['炭棒内径'])
  // ② 改过名的键（本面板叫 炭棒出货长度）
  put('炭棒出货长度', source['炭棒长度'] ?? source['炭棒出货长度'])

  // ③ 整串解析：还有空格才做
  if (need('炭棒外径') || need('炭棒内径') || need('炭棒出货长度')) {
    const whole = textOf(source['炭棒尺寸']) || textOf(source['产品整体尺寸'])
    if (whole) {
      const r = parseRodSizeRequirement(whole)
      put('炭棒外径', r['炭棒外径'])
      put('炭棒内径', r['炭棒内径'])
      put('炭棒出货长度', r['炭棒出货长度'])
    }
  }
  return out
}
