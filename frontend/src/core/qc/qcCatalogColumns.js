/**
 * 检验目录(QC_CATALOG)控制列表 —— 列定义的唯一真源。
 *
 * 【与项目进度查询同构】
 * RD_PROGRESS 的控制列表把"显示名"和"落库数据键"分开(progressColumns.js 里有历史坑),
 * 本表**两者同名**:yj_field.col_name 就是原表列名(检测物料类别/物料名称/批次号/数量/检验状态/是否合格),
 * 所以前端直接用中文列名当数据键,后端 labelsToCols 能原样对上,不会丢库。
 * 若将来某列要改显示名,必须照 progressColumns.js 的做法加 label→key 映射,不可直接改名。
 *
 * 【表结构来源】《品质资料 2026.09.19.xlsx》「检验目录」页签,三组表头一比一:
 *   第1类 检测物料类别 → 第2类 物料名称 → 第3类 检验记录目录(批次号|数量|检验状态|是否合格)
 */

/** qc_catalog_detail 的物理列(yj_field where panel_code='QC_CATALOG' and place='detail') */
export const QC_CATALOG_DETAIL_COLUMNS = Object.freeze([
  '检测物料类别', '物料名称', '物料编码', '批次号', '数量', '检验状态', '是否合格',
  '检验单号', '检验数据记录单号',
])

/** 表头三级分组(与原表 第1类/第2类/第3类 行一致;第2类=物料层,第3类=检验记录目录) */
export const QC_CATALOG_HEADER_GROUPS = Object.freeze([
  { label: '第1类', span: 1 },
  { label: '第2类', span: 2 },
  { label: '第3类', span: 6 },
])

/** 列定义:label=表头显示名,key=落库数据键(本表同名),group=所属二/三级表头 */
export const QC_CATALOG_COLUMNS = Object.freeze([
  { label: '检测物料类别', key: '检测物料类别', width: 14, group: '第1类' },
  { label: '物料名称', key: '物料名称', width: 16, group: '第2类' },
  { label: '物料编码', key: '物料编码', width: 13, group: '第2类' },
  { label: '批次号', key: '批次号', width: 12, group: '检验记录目录' },
  { label: '数量', key: '数量', width: 9, group: '检验记录目录' },
  { label: '检验状态', key: '检验状态', width: 11, group: '检验记录目录' },
  { label: '是否合格', key: '是否合格', width: 9, group: '检验记录目录' },
  { label: '检验单号', key: '检验单号', width: 14, group: '检验记录目录' },
  { label: '检验数据记录单号', key: '检验数据记录单号', width: 16, group: '检验记录目录' },
])

/** 前两列是分组列(合并单元格);物料编码同属物料层但不合并 */
export const QC_CATALOG_GROUP_KEYS = Object.freeze(['检测物料类别', '物料名称'])

/** 明细必填列(与 yj_field required=1 一致;自动生成时由检验单带下) */
export const QC_CATALOG_REQUIRED_KEYS = Object.freeze(['检测物料类别', '物料名称', '批次号'])

/** 检验状态两态(与 yj_field 字典、后端 QcCatalogService 一致) */
export const QC_STATUS_DOING = '正在检验中'
export const QC_STATUS_DONE = '已完成检验'

/** Excel 导出用:表头行 = 列显示名 */
export function exportHeaderRow() {
  return QC_CATALOG_COLUMNS.map((c) => c.label)
}

/** Excel 导出用:一行数据按列定义取值 */
export function exportRow(row) {
  return QC_CATALOG_COLUMNS.map((c) => (row ? row[c.key] : ''))
}
