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
