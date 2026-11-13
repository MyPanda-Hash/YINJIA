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
 * 命中分组 → 检验报告表体的行(已去重、已剔除空数据列)。
 *
 * 【2026-11-11 用户口径:一个父目录 = 报告里的一行,值分两列】
 *   检验项   = **父目录名**(父目录自己没有数据,纸面只显示这个标题)
 *   检测标准 = 子目录1 的数据
 *   检验方法 = 子目录2 的数据
 * 判定"哪个子目录进哪一列"的顺序(稳):
 *   ① 名字里带「方法」⇒ 检验方法 列;带「标准」⇒ 检测标准 列(现有数据就叫 检验方法N / 检验标准N);
 *   ② 名字看不出来(如 子目录1/子目录2)⇒ 按子列顺序:第 1 个进 检测标准、第 2 个进 检验方法;
 *   ③ 超过两个子列的部分忽略(与「一个父目录带两个子目录」的格式要求一致)。
 * 没有父目录的独立列仍是「一格一行」(检验项=列名、检测标准=值)。
 *
 * @param {Array} groups lookupReqGroups 的结果
 * @param {Array<{label:string, tab?:string, parent?:string}>} [extFields] 来料检验要求的动态字段(/px/extFields 的 fields)
 * @returns {Array<{检验项: string, 检测标准: string, 检验方法: string}>}
 */
export function carryEntriesOf(groups, extFields) {
  const out = []
  const seen = new Set()
  const skip = (k) => ID_COLS.includes(k) || HEAD_ONLY_COLS.includes(k) || isNonBiz(k)
  /** 该子列的这格数据落在报告哪一列(检测标准 / 检验方法) */
  const targetOf = (label, order) => {
    const s = String(label ?? '')
    if (s.includes('方法')) return '检验方法'
    if (s.includes('标准')) return '检测标准'
    return order === 0 ? '检测标准' : '检验方法'
  }
  for (const g of Array.isArray(groups) ? groups : []) {
    let colDefs = g?.tab ? colsOfTab(g.tab, extFields) : fallbackColsOf(g?.rows).map((k) => ({ key: k }))
    if (g?.tab?.dynamicCols && colDefs.length <= 1) colDefs = fallbackColsOf(g?.rows).map((k) => ({ key: k }))
    for (const row of Array.isArray(g?.rows) ? g.rows : []) {
      // ① 先把这一行按"父分组"聚起来(按列序),同时收无父的独立列
      const groupsOfRow = new Map()   // parent -> 子列 key 列表(按列序)
      const standalone = []
      for (const c of colDefs) {
        const key = c?.key
        if (!key || skip(key)) continue
        if (c.group) {
          if (!groupsOfRow.has(c.group)) groupsOfRow.set(c.group, [])
          groupsOfRow.get(c.group).push(c)
        } else {
          standalone.push(c)
        }
      }
      // ② 每个父目录 = 一行:检验项=父名,子列值按名字/顺序落到 检测标准 / 检验方法
      for (const [parent, children] of groupsOfRow) {
        const pk = carryKeyOf(parent)
        if (!pk || seen.has(pk)) continue
        const entry = { 检验项: parent, 检测标准: '', 检验方法: '' }
        let filled = 0
        children.slice(0, 2).forEach((c, idx) => {
          const v = String(row?.[c.key] ?? '').trim()
          if (!v) return
          const col = targetOf(c.key, idx)
          // 同列已有值(名字判定与顺序判定打架时)就让位给后一个空列,绝不覆盖已有
          if (entry[col]) {
            const other = col === '检测标准' ? '检验方法' : '检测标准'
            if (!entry[other]) entry[other] = v
            return
          }
          entry[col] = v
          filled += 1
        })
        if (!filled) continue          // 两个子目录都没数据 ⇒ 整组不出行
        seen.add(pk)
        out.push(entry)
      }
      // ③ 没有父目录的独立列:仍是 一格一行
      for (const c of standalone) {
        const std = String(row?.[c.key] ?? '').trim()
        if (!std) continue
        const k = carryKeyOf(c.key)
        if (!k || seen.has(k)) continue
        seen.add(k)
        out.push({ 检验项: c.key, 检测标准: std, 检验方法: '' })
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
