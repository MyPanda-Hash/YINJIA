/**
 * qcInspReqConfig.js — 来料检验要求面板(QC_INSP_REQ)7 页签配置
 * 依据《品质资料 2026.09.19.xlsx》自「折叠棉」起的 7 张检验要求表一比一复刻:
 *   页签条 = 规格书式 rsp-pages;每页 = 大标题行 + 两行分组表头 + Excel 原列宽数据行。
 * 数据键 = 中文标签 = qc_insp_req 物理列名;行按 [物料类别]=tab.key 分流到各页签
 * (同名叶列跨页签共用一列,如 脏污、头发丝 6 个页签共用;PP管 原表 B 空列丢弃)。
 * 列定义:w=Excel 原列宽 px;rowspan:2=纵向合并两行的独立表头;group=两行分组表头的子列。
 */
export const qcInspReqTabs = [
  {
    key: '折叠棉',
    sheetTitle: '折叠棉检验要求',
    cols: [
      { key: '物料编号', w: 140, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '折叠棉', w: 140, group: '规格' },
      { key: '炭棒', w: 140, group: '规格' },
      { key: '实配炭棒后外径', w: 140, group: '规格' },
      { key: '折数', w: 125, rowspan: 2 },
      { key: '折高', w: 125, rowspan: 2 },
    ],
  },
  {
    key: '垫片',
    sheetTitle: '垫片/密封圈检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '外径', w: 101, group: '规格' },
      { key: '内径', w: 123, group: '规格' },
      { key: '厚度', w: 81, group: '规格' },
      { key: '实配端盖效果', w: 83, rowspan: 2 },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '材质', w: 116, group: '外观' },
    ],
  },
  {
    key: '无纺布',
    sheetTitle: '无纺布检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '长', w: 101, group: '规格（片布）' },
      { key: '宽', w: 123, group: '规格（片布）' },
      { key: '克数', w: 81, group: '规格（片布）' },
      { key: '宽度', w: 83, group: '规格（卷布）' },
      { key: '克重', w: 83, group: '规格（卷布）' },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '颜色（白/黑）', w: 116, group: '外观' },
    ],
  },
  {
    key: '网套',
    sheetTitle: '网套检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '尺寸', w: 118, group: '规格' },
      { key: '实配炭棒后外径', w: 118, group: '规格' },
      { key: '实配端盖', w: 118, group: '规格' },
      { key: '折数', w: 83, rowspan: 2 },
      { key: '叠高', w: 83, rowspan: 2 },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '接口牢固度', w: 116, group: '外观' },
    ],
  },
  {
    key: 'PP管',
    sheetTitle: 'PP胶管检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '长', w: 101, group: '规格' },
      { key: '内径', w: 92, group: '规格' },
      { key: '外径', w: 81, group: '规格' },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '破损、切斜', w: 116, group: '外观' },
    ],
  },
  {
    key: '端盖',
    sheetTitle: '端盖检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '外径1', w: 101, group: '规格' },
      { key: '外径2', w: 123, group: '规格' },
      { key: '高度', w: 81, group: '规格' },
      { key: '外径（+密封圈）', w: 118, group: '外观' },
      { key: '出水口堵孔、批锋', w: 83, group: '外观' },
      { key: '脏污、头发丝', w: 116, group: '外观' },
      { key: '变形、破损', w: 116, group: '外观' },
    ],
  },
  {
    key: 'PP棉',
    sheetTitle: 'PP棉检验要求',
    cols: [
      { key: '物料编号', w: 102, rowspan: 2 },
      { key: '文件编码', w: 120, rowspan: 2 },
      { key: '检验依据', w: 130, rowspan: 2 },
      { key: '尺寸', w: 146, group: '规格' },
      { key: '实配炭棒', w: 146, group: '规格' },
      { key: '实配端盖', w: 146, group: '规格' },
      { key: '切面（平整、无歪斜）', w: 119, group: '外观' },
      { key: '脏污、头发丝', w: 119, group: '外观' },
      { key: '破损、变形', w: 119, group: '外观' },
    ],
  },
]

/** 页签 key → 配置 */
export function qcInspReqTabOf(key) {
  return qcInspReqTabs.find((t) => t.key === key) || null
}

/* ═══════════ 两个「来料检验要求」面板(2026-10-04 用户口径:表太多挤在一个面板,拆成两个)═══════════
 * · QC_INSP_REQ        —— 本文件上面 7 张**固定**表(Excel 一比一复刻)+ 每表可加自定义列
 * · QC_INSP_REQ_SERIES —— 10 张**全自定义**表(阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/
 *                          抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料),列全由动态字段承载
 * 两个面板同构:档案式整表、行按 物料类别 分流到页签、每表各 20 个扩展位、自定义列可带父字段(分组表头)、
 * 检验数据记录都按物料编码带入(只带子字段)。差别只在:一个是固定表,一个是全自定义表。
 * (原先那个「自定义检验要求」页签已下线 —— 它连同 10 张系列表独立成一个面板:表不再挤在一个面板里。)
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
 * · QC_INSP_REQ:静态配置(7 张 Excel 复刻表,列宽/分组表头都在本文件);
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
