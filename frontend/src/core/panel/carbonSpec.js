/**
 * carbonSpec.js — 选「产品编号」后把炭棒外径/内径/长度 落进成型工艺清单的三个窄格(纯函数,可 node --test 断言)
 *
 * 背景(2026-10-14 用户报障「点击选择炭棒编号时应该自动带入对应的炭棒外径内径长度;现在状态为需要手动输入」):
 *   成型工艺清单(RD_MOLD_PROC)页 1「产品基本信息」的「炭棒规格」是三窄格(炭棒规格1/2/3,
 *   纸上以 `外：` / `内：` / `长：` 前缀区分数值)。原先的回填只读产品信息表那一行的
 *   **「炭棒尺寸」整串**(源 Excel 里它是"外径 12 mm 内径 5 mm 长度 60 mm"这种一整句),
 *   但库里实测该列**永远为空** —— 真源是三个独立列 `炭棒外径` / `炭棒内径` / `炭棒长度`
 *   (2026-10-14 查 HSDZ_MES_TEST.rd_prod_info_head:CSBH/CSCS 两单三列均为裸数字 `5`)。
 *
 * 口径:
 *   ① 三个独立字段**优先**,「炭棒尺寸」整串**只作逐格回退**(老单/只填了整串的历史数据);
 *   ② 每格**各自判空**:没值就连前缀都不写,绝不落 `外：` 这种半截值;
 *   ③ 两种来源落格文本**完全同款**(`外：` + 数值),同一张纸上不该看出数据是从哪来的;
 *   ④ 三个格一个都没有的面板(如组装工艺清单)由 enabled=false 整体关掉。
 */

/** 三个窄格 ↔ 前缀(label 顺序即格序,来自 yj_field.label) */
const SPEC_SLOTS = [
  { key: '炭棒规格1', prefix: '外：', own: '炭棒外径', kw: '外径' },
  { key: '炭棒规格2', prefix: '内：', own: '炭棒内径', kw: '内径' },
  { key: '炭棒规格3', prefix: '长：', own: '炭棒长度', kw: '长度' },
]

const textOf = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * 产品信息表的参照行 → 炭棒规格三格的值。
 *
 * @param {object|null} source   参照行(键 = 产品信息表的字段 label)
 * @param {boolean} enabled      本面板是否有这三个格(调用方传 fieldMap.has('炭棒规格1'))
 * @returns {Record<string,string>} **只含非空格**的 { 炭棒规格1: '外：12', ... };
 *          调用方直接按条目写 head 即可 —— 空键不出现 = 不覆盖纸上已有的值。
 */
export function carbonSpecFrom(source, enabled = true) {
  const out = {}
  if (!enabled || !source) return out
  const sizeStr = textOf(source['炭棒尺寸'])
  for (const s of SPEC_SLOTS) {
    // ① 独立字段优先(裸数字,trim 后照原样落格)
    const own = textOf(source[s.own])
    if (own) {
      out[s.key] = s.prefix + own
      continue
    }
    // ② 该格独立字段为空 ⇒ 逐格回退整串(与旧实现同一条正则:关键词 + 数字 + mm)
    if (!sizeStr) continue
    const v = (sizeStr.match(new RegExp(s.kw + '\\s*([0-9.]+)\\s*mm')) || [])[1]
    if (v) out[s.key] = s.prefix + v
  }
  return out
}
