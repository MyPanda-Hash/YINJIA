/**
 * carbonSpec.js — 选「产品编号」后把炭棒外径/内径/长度 落进成型工艺清单的三个窄格(纯函数,可 node --test 断言)
 *
 * 背景(2026-10-14 用户报障「点击选择炭棒编号时应该自动带入对应的炭棒外径内径长度;现在状态为需要手动输入」):
 *   成型工艺清单(RD_MOLD_PROC)页 0「产品基本信息」的「炭棒规格」是三窄格(炭棒规格1/2/3,
 *   顺序 = 外径 / 内径 / 长度,靠列位区分)。原先的回填只读产品信息表那一行的
 *   **「炭棒尺寸」整串**(源 Excel 里它是"外径 12 mm 内径 5 mm 长度 60 mm"这种一整句),
 *   但库里实测该列**永远为空** —— 真源是三个独立列 `炭棒外径` / `炭棒内径` / `炭棒长度`
 *   (2026-10-14 查 HSDZ_MES_TEST.rd_prod_info_head:CSBH/CSCS 两单三列均为裸数字 `5`)。
 *
 * ⚠ 2026-11-03 改口径(用户报障「服务器上的烧结工艺清单导进来的炭棒规格带文字,
 *   导致后续计算有问题,还得我手动删掉,给出解决方法然后修复这个问题」):
 *   **落格文本改成裸数字,不再写进数据**。
 *
 *   为什么必须这么改(不是"另一个写法也可以"):
 *     前缀写进数据后,凡是按数字消费这些格的地方都得额外兼容一次。`parseSpecNumber` 兼容了,
 *     但 `matchSinterModel`(烧结型号自动匹配)与 `sinterLengthWarning`(长度越界提示)走的是
 *     `numOf`/`Number()` ⇒ `Number('外：56.5')` = NaN ⇒ **静默失效**:
 *     型号选不中、越界不提示,用户只看到"算不对",最后只能手删那段文字。
 *     数据键存的是**值**,`外：` 是**表现** —— 两者混在一起就是这次事故。
 *
 * ⚠ 2026-11-06 再改(用户口径「研发管理的烧结工艺清单的炭棒规格的外：、内：、长：,
 *   这些表格内背景词去掉」):**纸面也不显示前缀了** —— recordSheetConfigs 三格不再挂 `pre`,
 *   只剩数字输入框(此前 `pre` 挂在这里渲染)。本文件的映射(格键 ↔ 产品信息表独立字段)照旧,
 *   只是再也没有显示用的前缀,单测见 core/views/recordSheetConfigs.rodSpec.test.js。
 *
 * 口径:
 *   ① 三个独立字段**优先**,「炭棒尺寸」整串**只作逐格回退**(老单/只填了整串的历史数据);
 *   ② 每格**各自判空**:没值就一个格都不写,绝不落 `外：` 这种半截值;
 *   ③ 落格一律**裸数字**,纸面同样只有数字(2026-11-06 起);
 *   ④ 三个格一个都没有的面板(如组装工艺清单)由 enabled=false 整体关掉。
 */

/** 三个窄格 ↔ 产品信息表的独立字段(label 顺序即格序,来自 yj_field.label) */
const SPEC_SLOTS = [
  { key: '炭棒规格1', own: '炭棒外径', kw: '外径' },
  { key: '炭棒规格2', own: '炭棒内径', kw: '内径' },
  { key: '炭棒规格3', own: '炭棒长度', kw: '长度' },
]

const textOf = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * 产品信息表的参照行 → 炭棒规格三格的值。
 *
 * @param {object|null} source   参照行(键 = 产品信息表的字段 label)
 * @param {boolean} enabled      本面板是否有这三个格(调用方传 fieldMap.has('炭棒规格1'))
 * @returns {Record<string,string>} **只含非空格**的 { 炭棒规格1: '12', ... };
 *          调用方直接按条目写 head 即可 —— 空键不出现 = 不覆盖纸上已有的值。
 */
export function carbonSpecFrom(source, enabled = true) {
  const out = {}
  if (!enabled || !source) return out
  const sizeStr = textOf(source['炭棒尺寸'])
  for (const s of SPEC_SLOTS) {
    // ① 独立字段优先(裸数字,trim 后照原样落格 —— 不拼前缀)
    const own = textOf(source[s.own])
    if (own) {
      out[s.key] = own
      continue
    }
    // ② 该格独立字段为空 ⇒ 逐格回退整串(关键词 + 数字,允许尾随 mm)
    if (!sizeStr) continue
    const v = (sizeStr.match(new RegExp(s.kw + '\\s*([0-9.]+)\\s*(?:mm)?')) || [])[1]
    if (v) out[s.key] = v
  }
  return out
}