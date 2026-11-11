/**
 * 检验数据记录(QC_INSP_REC)检验报告 —— 版式与字段定义的唯一真源。
 *
 * 【版式来源】《品质资料 2026.09.19.xlsx》「检验数据记录模版」页签(整张 YJ-QR-96 检验报告):
 *   抬头: 物料名称 / 物料编码 / 物料批次 / 检验日期 ｜ 来料日期 / 来料数量 / 文件编码(YJ-QR-96) / 检验依据(YJ-Q-30)
 *   表体: 检验项(数据库选择) | 检测标准 | 检测结果(固定五格) | 单项判定
 *   表尾: 检验结论 / 处理意见 ｜ 检验人(账号登录人自动生成) / 审核人(固定:冯敏)
 *
 * 【检测结果 = 固定五格(2026-11-11 用户口径)】
 *   「检验数据记录的检验结果改为固定五格。」原来每行只有一个文本域,现在固定 5 个格子,
 *   一格一个实测值(抽 5 件 / 测 5 次),落库列 `结果1..结果5`(migrate-qc-insp-rec-result5-20261111.sql)。
 *   旧列 `检测结果`(整段文字)保留为历史 → 迁移时已把老值落到 `结果1`,那一列不再展示。
 *
 * 【键口径】yj_field 里 label == col_name(与检验目录同理),所以前端中文列名即落库键;
 *   后端 rowToLabels 载入按标签、labelsToCols 保存按标签映射,两侧一致才不会丢库。
 *   ⚠ 五个格子必须各自在 yj_field(place=detail) 登记,**物理列有而 yj_field 没有 = 填了静默丢失**。
 */

/** 抬头区(原表右上/左上两列成对布局):左标签-右值 各一行,两列成对。
 *  `locked`:需要**回填/带入**的字段只读 ——
 *  · 物料批次:批次号在采购入库审核时才分配并回填(BatchService 回填检验单/检验目录/本报告),录入阶段不许手填;
 *  · 文件编码 / 检验依据:按**物料编码**从「来料检验要求」对应行的同名两列带入(2026-10-04 用户口径
 *    「要靠物料编码来对应填入,并且不可以修改」),故纸面只显示文本、不给输入框。
 *  程序化带入(「带入检验要求」/自动带入)不受影响。 */
export const QC_INSP_REC_HEAD_ROWS = Object.freeze([
  [{ label: '物料名称', key: '物料名称' }, { label: '来料日期', key: '来料日期' }],
  [{ label: '物料编码', key: '物料编码' }, { label: '来料数量', key: '来料数量' }],
  [{ label: '物料批次', key: '物料批次', locked: true }, { label: '文件编码', key: '文件编码', locked: true }],
  [{ label: '检验日期', key: '检验日期' }, { label: '检验依据', key: '检验依据', locked: true }],
])

/**
 * 检测结果 = **固定五格**的数据键(顺序即纸面 1..5 的次序,唯一真源)。
 * 组件按它渲染 5 个格子 / 导出按它出 5 列;长度写死为 5,任何"多加一格"的改动都必须同时动
 * 迁移脚本(结果1..结果5)、yj_field 登记与本文,否则保存会丢值。
 */
export const QC_INSP_REC_RESULT_KEYS = Object.freeze(['结果1', '结果2', '结果3', '结果4', '结果5'])

/** 表体数据列(qc_insp_rec_detail):检验项 | 检测标准 | 检验方法 | 结果1..结果5 | 单项判定
 *  ⚠ 旧列 `检测结果`(整段文字)已转历史列(visible=0/hidden=1),不在表体列里;
 *  `检验方法` 是 2026-11-11 新增:来料检验要求「父目录 + 两个子目录」带入时,
 *  一个子目录的值进 检测标准、另一个进 检验方法(用户口径:检验项=父目录标题 / 检验标准=子目录1 / 检验方法=子目录2) */
export const QC_INSP_REC_DETAIL_COLUMNS = Object.freeze([
  '检验项', '检测标准', '检验方法', ...QC_INSP_REC_RESULT_KEYS, '单项判定',
])

/** 表体列定义(label=表头显示名=落库数据键;width=Excel 导出列宽) */
export const QC_INSP_REC_COLUMNS = Object.freeze([
  { label: '检验项', key: '检验项', width: 18, lib: 'qc.insp_item' },
  { label: '检测标准', key: '检测标准', width: 24 },
  { label: '检验方法', key: '检验方法', width: 24 },
  ...QC_INSP_REC_RESULT_KEYS.map((k, i) => ({ label: k, key: k, width: 10, result: i + 1 })),
  { label: '单项判定', key: '单项判定', width: 12 },
])

/** 表尾区(2026-11-11 用户口径:按 YJ-QR-96 模板排成**两行两对** ——
 *  左列「检验人 / 审核人」、右列「检验结论 / 处理意见」;
 *  原来是「检验结论」「处理意见」各占整行、签名行单独一行(三行),与模板不一致):
 *
 *    第 1 行: 检验人 | 值 | 检验结论 | 值
 *    第 2 行: 审核人 | 值 | 处理意见 | 值
 *
 *  `locked`:检验人=新增时按登录人生成 → 只读;
 *  审核人落库列是 表单审核人(叫「审核人」会被 ButtonService 当审核留痕丢弃),纸面仍印「审核人」。 */
export const QC_INSP_REC_FOOT_ROWS = Object.freeze([
  [{ label: '检验人', key: '检验人', locked: true }, { label: '检验结论', key: '检验结论' }],
  [
    { label: '审核人', key: '表单审核人', displayKey: '表单审核人', auditKey: '审核人' },
    { label: '处理意见', key: '处理意见' },
  ],
])

/** 处理意见的标准库编码(2026-11-11:「处理意见做成标准库的形式」)——
 *  与「检验项」同一套机制:字段 data_type=标准库、dict_sql 存库编码,条目在 yj_std_lib 里增删维护 */
export const QC_INSP_REC_DISPOSAL_LIB = 'qc.insp_disposal'

/** 检验结论的标准库编码(2026-11-11 第二轮:「只要合格和不合格,没有特采;直接设计成标准库的形式」)。
 *  候选由 yj_std_lib 维护(先播 合格 / 不合格),不再写死在 yj_field.dict_sql 的 VALUES 里 */
export const QC_INSP_REC_VERDICT_LIB = 'qc.insp_verdict'

/** 检验项所在的标准库编码(与原表「检验项为数据库选择」对应) */
export const QC_INSP_ITEM_LIB = 'qc.insp_item'

/** Excel 导出:表头行 + 一行取值 */
export function exportHeaderRow() {
  return QC_INSP_REC_COLUMNS.map((c) => c.label)
}
export function exportRow(row) {
  return QC_INSP_REC_COLUMNS.map((c) => (row ? row[c.key] : ''))
}
