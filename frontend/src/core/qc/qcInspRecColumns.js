/**
 * 检验数据记录(QC_INSP_REC)检验报告 —— 版式与字段定义的唯一真源。
 *
 * 【版式来源】《品质资料 2026.09.19.xlsx》「检验数据记录模版」页签(整张 YJ-QR-96 检验报告):
 *   抬头: 物料名称 / 物料编码 / 物料批次 / 检验日期 ｜ 来料日期 / 来料数量 / 文件编码(YJ-QR-96) / 检验依据(YJ-Q-30)
 *   表体: 检验项(数据库选择) | 检测标准 | 检测结果 | 单项判定
 *   表尾: 检验结论 / 处理意见 ｜ 检验人(账号登录人自动生成) / 审核人(固定:冯敏)
 *
 * 【键口径】yj_field 里 label == col_name(与检验目录同理),所以前端中文列名即落库键;
 *   后端 rowToLabels 载入按标签、labelsToCols 保存按标签映射,两侧一致才不会丢库。
 */

/** 抬头区(原表右上/左上两列成对布局):左标签-右值 各一行,两列成对 */
export const QC_INSP_REC_HEAD_ROWS = Object.freeze([
  [{ label: '物料名称', key: '物料名称' }, { label: '来料日期', key: '来料日期' }],
  [{ label: '物料编码', key: '物料编码' }, { label: '来料数量', key: '来料数量' }],
  [{ label: '物料批次', key: '物料批次' }, { label: '文件编码', key: '文件编码' }],
  [{ label: '检验日期', key: '检验日期' }, { label: '检验依据', key: '检验依据' }],
])

/** 表体四列(qc_insp_rec_detail) */
export const QC_INSP_REC_DETAIL_COLUMNS = Object.freeze([
  '检验项', '检测标准', '检测结果', '单项判定',
])

/** 表体列定义(label=表头显示名=落库数据键;width=Excel 导出列宽) */
export const QC_INSP_REC_COLUMNS = Object.freeze([
  { label: '检验项', key: '检验项', width: 18, lib: 'qc.insp_item' },
  { label: '检测标准', key: '检测标准', width: 24 },
  { label: '检测结果', key: '检测结果', width: 40 },
  { label: '单项判定', key: '单项判定', width: 12 },
])

/** 表尾区:检验结论/处理意见(整宽) + 签名行 */
export const QC_INSP_REC_FOOT_FULL = Object.freeze([
  { label: '检验结论', key: '检验结论' },
  { label: '处理意见', key: '处理意见' },
])
export const QC_INSP_REC_SIGN_ROW = Object.freeze([
  { label: '检验人', key: '检验人', locked: true },
  // 原表印「审核人 固定:冯敏」。落库列名不能叫「审核人」——ButtonService 保存时显式丢弃
  // 「审核人/审核时间」(那是 yj_doc_status.shr 审核留痕的虚拟字段),故用专属列 表单审核人,
  // 纸面仍按原表显示「审核人」;单据真审核后另有虚拟键 审核人(=shr)可作只读兜底。
  { label: '审核人', key: '表单审核人', displayKey: '表单审核人', auditKey: '审核人' },
])

/** 检验项所在的标准库编码(与原表「检验项为数据库选择」对应) */
export const QC_INSP_ITEM_LIB = 'qc.insp_item'

/** Excel 导出:表头行 + 一行取值 */
export function exportHeaderRow() {
  return QC_INSP_REC_COLUMNS.map((c) => c.label)
}
export function exportRow(row) {
  return QC_INSP_REC_COLUMNS.map((c) => (row ? row[c.key] : ''))
}
