/**
 * qcInspReqCarry.js — 「来料检验要求 → 检验报告表体」带入逻辑(纯函数,无 Vue 依赖,可单测)
 *
 * 【用户口径(2026-10-04)】
 *   「更改检验报告,需要根据物料编码能够在来料检验要求找到对应的行。并且在检验项和检验标准中,
 *     做到对应填入检验项就是上面的检验项目,检验标准就是下面对应的数据。」
 *   即:来料检验要求(QC_INSP_REQ)那张 Excel 表 —— **列名(表头)= 检验项目**,
 *       该列在命中行里的**数据 = 检测标准**;逐列拆成检验报告的「检验项 / 检测标准」两列。
 *   例:PP管 YJ-JB-001 命中行 → 长=274.5±0.5 / 内径=6±0.2 / 外径=8.1±0.1
 *       → 报告三行:检验项「长」检测标准「274.5±0.5」…(顺序 = Excel 原列序 = 页签配置序)
 *   列名与标准库 qc.insp_item 的 25 条词条完全一致(那份词条就是从这 7 张表的非标识列名并集来的),
 *   故带入的检验项在下拉里选得中,不是新造词汇。
 *
 * 【合并口径(用户选:只补缺失项)】
 *   报告里已经有的检验项一律保留 —— **检测结果/单项判定绝不覆盖**,只把缺的按上述顺序补进来。
 *   于是「重复点带入」是幂等的:补过一遍之后再点,一行都不加。
 *
 * 【多页签/多行命中】按 qcInspReqTabs 配置序 + 组内 id 升序(由 lookupReqGroups 保证)展平;
 *   同名检验项只带一次,取**首个非空数据**那一行(实测同一编号跨页签的列名基本不重叠)。
 */
import { lookupReqGroups } from './qcInspReqLookup.js'
import { colsOfTab } from './qcInspReqCols.js'

/** 要求表的标识列:不进检验项(物料编号=匹配键;物料类别=页签分流键) */
const ID_COLS = Object.freeze(['物料编号', '物料类别'])
/** 非业务列(主键/审计列):配置外类别的兜底列名推导时要排掉 */
const NON_BIZ_COLS = Object.freeze(['id'])
const isNonBiz = (k) => NON_BIZ_COLS.includes(k) || String(k).startsWith('asp_')

/** 检验项去重键:去掉**所有**空白(半角/全角/换行)后再比 ——
 *  「脏污、头发丝」与「脏污、头发丝 」「外径 1」与「外径1」在业务上是同一项,
 *  因空格差异被当成两项就会带出一条重复行(标准库与 Excel 排版差异的常见来源)。 */
export function carryKeyOf(v) {
  return String(v ?? '').replace(/\s+/g, '')
}

/**
 * 配置外物料类别的兜底列名:取该组行对象的自有键顺序(JSON 键序 = SQL 选取列序),
 * 排掉标识列/主键/审计列。只为「不静默丢数据」,正常路径始终走页签配置的 cols。
 */
function fallbackColsOf(rows) {
  const out = []
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const k of Object.keys(row || {})) {
      if (ID_COLS.includes(k) || isNonBiz(k) || out.includes(k)) continue
      out.push(k)
    }
  }
  return out
}

/**
 * 命中分组 → 检验报告的「检验项 / 检测标准」条目(已去重、已剔除空数据列)。
 * @param {Array} groups lookupReqGroups 的结果
 * @param {Array<{label:string, tab?:string}>} [extFields] 来料检验要求的动态字段(/px/extFields 的 fields):
 *        每张表各自的自定义列也在这张表里带入(用户口径 2026-10-04「自定义字段单独针对每个表」)。
 *        不传 = 只带固定列(与改动前等价)。
 * @returns {Array<{检验项: string, 检测标准: string}>}
 */
export function carryEntriesOf(groups, extFields) {
  const out = []
  const seen = new Set()
  for (const g of Array.isArray(groups) ? groups : []) {
    // 列序与界面**同源**(colsOfTab):固定列在前(Excel 原列序)、该表的自定义列追加在后;
    // 配置外物料类别(理论上不会有)没有页签配置,退回按行自身的键序(后端按 yj_field 顺序下发)。
    let cols = g?.tab ? colsOfTab(g.tab, extFields).map((c) => c.key) : fallbackColsOf(g?.rows)
    // 兜底:全自定义页签的列全在动态字段里 —— 字段清单取不到(接口失败/调用方没传)时,
    // 退回按行自身键序,否则那张表会**一条都带不出来**(静默丢数据,比列序不理想严重得多)。
    if (g?.tab?.dynamicCols && cols.length <= 1) cols = fallbackColsOf(g?.rows)
    for (const row of Array.isArray(g?.rows) ? g.rows : []) {
      for (const key of cols) {
        if (ID_COLS.includes(key) || isNonBiz(key)) continue
        const std = String(row?.[key] ?? '').trim()
        // 该列数据为空 ⇒ 这条要求没有可填的检测标准,不成一项(带走一行空标准只会添乱)
        if (!std) continue
        const k = carryKeyOf(key)
        if (!key || !k || seen.has(k)) continue
        seen.add(k)
        out.push({ 检验项: key, 检测标准: std })
      }
    }
  }
  return out
}

/**
 * 从条目里挑出报告**还没有**的检验项(已有的连同行内已填的检测结果/判定一起保留)。
 * @param {Array<object>} existingItems 报告表体现有行(键=『检验项』)
 * @param {Array<{检验项: string, 检测标准: string}>} entries carryEntriesOf 的结果
 * @returns {Array<{检验项: string, 检测标准: string}>} 需要补进来的行(顺序同 entries)
 */
export function missingCarryRows(existingItems, entries) {
  const have = new Set(
    (Array.isArray(existingItems) ? existingItems : [])
      .map((r) => carryKeyOf(r?.['检验项']))
      .filter(Boolean),
  )
  return (Array.isArray(entries) ? entries : []).filter((e) => e && !have.has(carryKeyOf(e.检验项)))
}

/**
 * 一行到位:来料检验要求全量行 + 物料编码 + 报告现有行 → 该补进来的行。
 * @returns {{entries: Array<object>, add: Array<object>}} entries=该物料的全部可带入项;add=其中缺的
 */
export function carryPlan(reqRows, materialCode, existingItems, extFields) {
  const entries = carryEntriesOf(lookupReqGroups(reqRows, materialCode), extFields)
  return { entries, add: missingCarryRows(existingItems, entries) }
}
