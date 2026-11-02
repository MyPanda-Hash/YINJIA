/**
 * prodPickCarry.js —— 规格书封面「引用产品信息表」时，把候选行摊成封面要写的那几格
 *
 * 【为什么单独抽出来】
 *   这段逻辑原来直接写在 RecordSheetPanels.vue 的 confirmProdPick 里（一个 6000 行的组件），
 *   于是"映射对不对"只能靠读源码、跑整个弹窗来验。抽成纯函数后：
 *     · 映射表(recordSheetConfigs.RD_SPEC_DOC.prodPick.map)与其应用口径能单测；
 *     · 2026-11-02「应用场景带不出来」这类缺陷（map 漏项）能在测试里一眼定位。
 *
 * 【三条口径，与既有 autoFillSpec 一致】
 *   ① 空值**不回填** —— 不拿空串冲掉封面已录内容（那等于丢数据）；
 *   ② 被操作/被映射的格子**只写真正有值的那些**，调用方据此报「带入 N 项」；
 *   ③ `from` 允许写成**数组**，按顺序取第一个非空 —— 用于"客户（项目）名称"这种
 *      封面一格、源表两列（客户项目名称 / 客户名称）的情形（2026-11-02 用户口径
 *      「应用场景以及其他字段不能在规格书中带入」；产品信息表里 客户名称 有值、
 *      客户项目名称 为空时，封面那格不该空着）。
 */

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * 按映射项从候选行里取值。
 * @param {Record<string, any>|null} row 产品信息表的一行（键 = yj_field.label）
 * @param {string|string[]} from 来源字段名，数组时按顺序取第一个非空
 * @returns {string} 取到的值（空串表示这一项没有可用来源）
 */
export function carryValueOf(row, from) {
  const keys = Array.isArray(from) ? from : [from]
  for (const k of keys) {
    const v = norm(row?.[k])
    if (v) return v
  }
  return ''
}

/**
 * 整份映射 → 封面要写的格。只含"取到值"的项，故 `Object.keys(patch).length` 就是带入项数。
 * @param {Record<string, any>|null} row 产品信息表的一行
 * @param {Array<{from: string|string[], to?: string}>|null} map prodPick.map
 * @returns {Record<string, string>} { 封面数据键: 值 }
 */
export function buildCoverPatch(row, map) {
  const out = {}
  for (const m of Array.isArray(map) ? map : []) {
    const key = m?.to || (Array.isArray(m?.from) ? m.from[0] : m?.from)
    if (!key) continue
    const v = carryValueOf(row, m.from)
    if (v) out[key] = v
  }
  return out
}
