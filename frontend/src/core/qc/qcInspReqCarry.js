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
/** 只进报告**抬头**、不进表体的列:文件编码/检验依据 按物料编码带进报告的抬头两格
 *  (用户口径 2026-10-04:「检验报告里面的文件编码与检验依据,要靠物料编码来对应填入」),
 *  它们**不是检验项** —— 表体里不该出现「检验项=文件编码」这种行。 */
const HEAD_ONLY_COLS = Object.freeze(['文件编码', '检验依据'])

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
 *
 * 【2026-11-11 用户口径:父目录也占一行】自定义字段是「一个父目录 + 两个子目录」的结构,
 * 带入检验报告时按 **父目录第 1 行 → 子目录1 第 2 行 → 子目录2 第 3 行**:
 *   · 父目录行:检验项 = 父目录名,**检测标准留空**(父只做分组,没有自己的数据格);
 *   · 子行:检验项 = 子目录名,检测标准 = 该子列的数据;数据为空的子列不出行。
 * 没有父目录的列(历史自定义列/兜底列)仍是「一格一行」。
 *
 * @param {Array} groups lookupReqGroups 的结果
 * @param {Array<{label:string, tab?:string, parent?:string}>} [extFields] 来料检验要求的动态字段(/px/extFields 的 fields)
 * @returns {Array<{检验项: string, 检测标准: string}>}
 */
export function carryEntriesOf(groups, extFields) {
  const out = []
  const seen = new Set()
  const skip = (k) => ID_COLS.includes(k) || HEAD_ONLY_COLS.includes(k) || isNonBiz(k)
  for (const g of Array.isArray(groups) ? groups : []) {
    // 列序与界面**同源**(colsOfTab):前置列在前、该表的自定义列追加在后(同父分组保持相邻);
    // 配置外物料类别(理论上不会有)没有页签配置,退回按行自身的键序(后端按 yj_field 顺序下发)。
    let colDefs = g?.tab ? colsOfTab(g.tab, extFields) : fallbackColsOf(g?.rows).map((k) => ({ key: k }))
    // 兜底:全自定义页签的列全在动态字段里 —— 字段清单取不到(接口失败/调用方没传)时,
    // 退回按行自身键序,否则那张表会**一条都带不出来**(静默丢数据,比列序不理想严重得多)。
    if (g?.tab?.dynamicCols && colDefs.length <= 1) colDefs = fallbackColsOf(g?.rows).map((k) => ({ key: k }))
    for (const row of Array.isArray(g?.rows) ? g.rows : []) {
      // 该行每个父分组下是否真有数据 —— 父目录行只在它有子数据时才占一行(空父目录不添乱)
      const groupHasData = new Set()
      for (const c of colDefs) {
        if (!c?.group || skip(c.key)) continue
        if (String(row?.[c.key] ?? '').trim()) groupHasData.add(c.group)
      }
      const emittedParents = new Set()
      for (const c of colDefs) {
        const key = c?.key
        if (!key || skip(key)) continue
        // ① 父目录行(该组第一次出现时插在它的子列之前)
        if (c.group && groupHasData.has(c.group) && !emittedParents.has(c.group)) {
          emittedParents.add(c.group)
          const pk = carryKeyOf(c.group)
          if (pk && !seen.has(pk)) {
            seen.add(pk)
            out.push({ 检验项: c.group, 检测标准: '' })
          }
        }
        // ② 子列行:只有该格有数据才成一项(带走一行空标准只会添乱)
        const std = String(row?.[key] ?? '').trim()
        if (!std) continue
        const k = carryKeyOf(key)
        if (!k || seen.has(k)) continue
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
 * 从命中分组里取**报告抬头**要带入的两项:文件编码 / 检验依据(2026-10-04 用户口径:
 * 「检验报告里面的文件编码与检验依据,要靠物料编码来对应填入,并且不可以修改」)。
 * 口径:按页签配置序取**首个非空值**(与「检验项」的取法同源,不另立一套);
 * 要求表没填的项**不返回**(调用方保留报告原值/默认 YJ-QR-96 / YJ-Q-30)。
 * @param {Array} groups lookupReqGroups 的结果
 * @returns {{文件编码?: string, 检验依据?: string}}
 */
export const CARRY_HEAD_KEYS = Object.freeze(['文件编码', '检验依据'])
export function carryHeadOf(groups) {
  const out = {}
  for (const key of CARRY_HEAD_KEYS) {
    for (const g of Array.isArray(groups) ? groups : []) {
      for (const row of Array.isArray(g?.rows) ? g.rows : []) {
        const v = String(row?.[key] ?? '').trim()
        if (v) { out[key] = v; break }
      }
      if (out[key]) break
    }
  }
  return out
}

/**
 * 一行到位:来料检验要求全量行 + 物料编码 + 报告现有行 → 该补进来的行 + 抬头该带入的两项。
 * @param {Array} reqRows 两个面板的要求行(已合并)
 * @param {string} materialCode 物料编码
 * @param {Array} existingItems 报告表体现有行
 * @param {Array} [extFields] 两个面板的动态字段(合并传)
 * @param {Array} [tabs] 两个面板的页签全集(默认只有固定 7 张)
 * @returns {{entries: Array<object>, add: Array<object>, head: object}}
 *          entries=该物料的全部可带入项;add=其中缺的;head=报告抬头要写入的 文件编码/检验依据
 */
export function carryPlan(reqRows, materialCode, existingItems, extFields, tabs) {
  const groups = lookupReqGroups(reqRows, materialCode, tabs)
  const entries = carryEntriesOf(groups, extFields)
  return { entries, add: missingCarryRows(existingItems, entries), head: carryHeadOf(groups) }
}
