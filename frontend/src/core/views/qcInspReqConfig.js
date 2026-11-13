/**
 * qcInspReqConfig.js — 来料检验要求面板(QC_INSP_REQ)7 页签配置
 *
 * 【2026-11-11 用户口径】「将来料检验要求和来料检验要求(系列)的字段删除只保留物料编码和
 *   文件编码和检验依据这 3 个字段和自定义的字段。」
 *   ⇒ 每张固定表**不再有 Excel 原来那些检验列**(折叠棉/炭棒/外径/…,物理列已随迁移删除),
 *     只保留三个前置列:**物料编号 · 文件编码 · 检验依据**;其余列全部由「自定义字段」提供
 *     (备用列池 + yj_field.tab_key + col_group 父目录分组)。
 *   ⇒ 自定义字段的格式要求:一个**父目录**带**两个子目录**(父只做表头分组、没有数据格),
 *     检验报告带入时按 父目录第 1 行 / 子目录1 第 2 行 / 子目录2 第 3 行。
 *
 * 页签条 = 规格书式 rsp-pages;行按 [物料类别]=tab.key 分流到各页签。
 * 列定义:w=列宽 px;rowspan:2=纵向合并两行的独立表头;group=两行分组表头的子列。
 */
/** 每张表都有的三个前置列(物料编号=匹配键;文件编码/检验依据 按物料带进检验报告,报告内不可改) */
const LEAD = Object.freeze([
  { key: '物料编号', w: 140, rowspan: 2 },
  { key: '文件编码', w: 120, rowspan: 2 },
  { key: '检验依据', w: 130, rowspan: 2 },
])

export const qcInspReqTabs = [
  { key: '折叠棉', sheetTitle: '折叠棉检验要求', cols: LEAD.map((c) => ({ ...c })) },
  { key: '垫片', sheetTitle: '垫片/密封圈检验要求', cols: LEAD.map((c) => ({ ...c })) },
  { key: '无纺布', sheetTitle: '无纺布检验要求', cols: LEAD.map((c) => ({ ...c })) },
  { key: '网套', sheetTitle: '网套检验要求', cols: LEAD.map((c) => ({ ...c })) },
  { key: 'PP管', sheetTitle: 'PP胶管检验要求', cols: LEAD.map((c) => ({ ...c })) },
  { key: '端盖', sheetTitle: '端盖检验要求', cols: LEAD.map((c) => ({ ...c })) },
  { key: 'PP棉', sheetTitle: 'PP棉检验要求', cols: LEAD.map((c) => ({ ...c })) },
]

/** 页签 key → 配置 */
export function qcInspReqTabOf(key) {
  return qcInspReqTabs.find((t) => t.key === key) || null
}

/* ═══════════ 两个「来料检验要求」面板(2026-10-04 用户口径:表太多挤在一个面板,拆成两个)═══════════
 * · QC_INSP_REQ        —— 7 张固定表(页签固定,列 = 三个前置列 + 每表自定义列)
 * · QC_INSP_REQ_SERIES —— 10 张**全自定义**表(阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/
 *                          抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料),列全由动态字段承载
 * 两个面板同构:档案式整表、行按 物料类别 分流到页签、每表各 20 个扩展位、自定义列带父字段(分组表头)、
 * 检验数据记录都按物料编码带入。
 */
export const QC_INSP_REQ_PANEL = 'QC_INSP_REQ'
export const QC_INSP_REQ_SERIES_PANEL = 'QC_INSP_REQ_SERIES'
/** 走「来料检验要求」专属纸张面板(规格书式页签 + Excel 复刻表格)的面板码 */
export const QC_INSP_REQ_PANELS = [QC_INSP_REQ_PANEL, QC_INSP_REQ_SERIES_PANEL]

/** 是否属于这两个分页签的来料检验要求面板 */
export function isQcInspReqPanel(panelCode) {
  return QC_INSP_REQ_PANELS.includes(String(panelCode || ''))
}

/**
 * 该面板的页签集。
 * · QC_INSP_REQ:静态配置(7 张表,列 = 三个前置列;其余靠自定义字段);
 * · QC_INSP_REQ_SERIES:完全由**物料类别词典**决定(后端 /px/extFields 的 tabs,顺序即扩展池分段序)
 *   —— 加页签只改词典(迁移),前后端都不用改;每张表都是「全自定义」(列 = 该表自己的动态字段)。
 * @param {string} panelCode 面板码
 * @param {string[]} [apiTabs] 后端下发的页签(全自定义面板用)
 */
export function tabsOfPanel(panelCode, apiTabs) {
  if (String(panelCode || '') === QC_INSP_REQ_PANEL) return qcInspReqTabs
  return (Array.isArray(apiTabs) ? apiTabs : []).map((key) => ({
    key,
    sheetTitle: key,
    dynamicCols: true,   // 全自定义表:列只有 物料编号 + 本表的动态字段
    cols: [],
  }))
}
