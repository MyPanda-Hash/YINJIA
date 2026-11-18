/**
 * 检验数据记录(QC_INSP_REC)检验报告 —— 版式与字段定义的唯一真源。
 *
 * 【版式来源】《品质资料 2026.09.19.xlsx》「检验数据记录模版」页签(整张 YJ-QR-96 检验报告):
 *   抬头: 物料名称 / 物料编码 / 物料批次 / 检验日期 ｜ 来料日期 / 来料数量 / 文件编码(YJ-QR-96) / 检验依据(YJ-Q-30)
 *   表体: 检验项(数据库选择) | 检测标准 | 检测结果(可增删列,默认 5) | 单项判定
 *   表尾: 检验结论 / 处理意见 ｜ 检验人(账号登录人自动生成) / 审核人(固定:冯敏)
 *
 * 【检测结果 = **可增删列**(2026-11-19 用户口径,取代 2026-11-11 的「固定五格」)】
 *   用户原话:「检验结果改成可以新增列的形式,不要固定5格了。」
 *   · 列数存**头字段** `结果列数`(qc_insp_rec.结果列数 int,界面上不显示 —— 只做计数载体,
 *     与研发数据记录表的「样品数」同型:一张纸抽几件就填几列,不同单据可以不一样);
 *   · 纸面用「检测结果列 － n ＋」步进器维护:默认 **5**,最少 1、最多 **20**
 *     (上限 = qc_insp_rec_detail 的物理列 结果1..结果20;要更多必须再加物理列 + yj_field 登记);
 *   · 减列会**清空被减列已填的值**(确认弹窗后),加列即时生效;
 *   · 物理列: `migrate-qc-insp-rec-result5-20261111.sql`(结果1..5) +
 *     `migrate-qc-insp-rec-resultcols-20261119.sql`(结果6..20 + 头字段 结果列数)。
 *   旧列 `检测结果`(整段文字)保留为历史 → 2026-11-11 迁移时已把老值落到 `结果1`,那一列不再展示。
 *
 * 【键口径】yj_field 里 label == col_name(与检验目录同理),所以前端中文列名即落库键;
 *   后端 rowToLabels 载入按标签、labelsToCols 保存按标签映射,两侧一致才不会丢库。
 *   ⚠ 结果1..结果20 **全部**要按"可见列"在 yj_field(place=detail) 登记:
 *     隐藏列(visible=0/hidden=1)在 ButtonService.labelsToCols 的更新路径上**不接受空串清空**,
 *     于是"把格子删成空、保存后又变回原值"(2026-11-06 踩过)。物理列有而 yj_field 没有 = 填了静默丢失。
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
 * 检测结果的可增删列 —— **唯一真源**(顺序即纸面 1..n 的次序)。
 *
 * 物理列 = `qc_insp_rec_detail.结果1..结果20`(两个迁移脚本建成);
 * 张单据实际显示几列,由头字段 `结果列数` 决定(见 QC_INSP_REC_RESULT_COUNT_KEY)。
 * ⚠ 改这个长度 = 必须同时动迁移脚本(加物理列 + yj_field 登记)与本文,否则保存会丢值。
 */
export const QC_INSP_REC_MAX_RESULT_COLS = 20
/** 最少 1 列(「不要固定 5 格」⇒ 允许收到 1 格;0 列没有意义,纸面会缺整段) */
export const QC_INSP_REC_MIN_RESULT_COLS = 1
/** 默认 5 列(老单据 `结果列数` 为空、新增单据未动过步进器时都落到这里,与 2026-11-11 那版一致) */
export const QC_INSP_REC_DEFAULT_RESULT_COLS = 5

/** 计数载体:头字段数据键(= qc_insp_rec.结果列数 的 yj_field label;界面上不显示) */
export const QC_INSP_REC_RESULT_COUNT_KEY = '结果列数'

/** 结果列的全部数据键(1..MAX;顺序即纸面次序) */
export const QC_INSP_REC_RESULT_KEYS = Object.freeze(
  Array.from({ length: QC_INSP_REC_MAX_RESULT_COLS }, (_, i) => `结果${i + 1}`),
)

/** 把外来的列数收敛到 [MIN, MAX];非数字(undefined/空串/NaN) ⇒ 默认 5。
 *  后端取回的是 int,但也可能被人手改成文本,这里统一按 parseInt 兜住。 */
export function clampResultColCount(n) {
  const v = parseInt(n, 10)
  if (!Number.isFinite(v)) return QC_INSP_REC_DEFAULT_RESULT_COLS
  return Math.min(QC_INSP_REC_MAX_RESULT_COLS, Math.max(QC_INSP_REC_MIN_RESULT_COLS, v))
}

/** 某个列数下**实际渲染**的结果列键(纸面 1..n 格) */
export function activeResultKeys(count) {
  return QC_INSP_REC_RESULT_KEYS.slice(0, clampResultColCount(count))
}

/** 表体数据列(qc_insp_rec_detail):检验项 | 检测标准 | 检验方法 | 结果1..结果20 | 单项判定
 *  ⚠ 旧列 `检测结果`(整段文字)已转历史列(visible=0/hidden=1),不在表体列里;
 *  `检验方法` 是 2026-11-11 新增:来料检验要求「父目录 + 两个子目录」带入时,
 *  一个子目录的值进 检测标准、另一个进 检验方法(用户口径:检验项=父目录标题 / 检验标准=子目录1 / 检验方法=子目录2) */
export const QC_INSP_REC_DETAIL_COLUMNS = Object.freeze([
  '检验项', '检测标准', '检验方法', ...QC_INSP_REC_RESULT_KEYS, '单项判定',
])

/** 表体列定义(label=表头显示名=落库数据键;width=Excel 导出列宽)。
 *  ⚠ 这是**物理列全量**(结果1..结果20):用于「元数据列对得上」的回归比对,
 *  不是某张单据实际显示的列 —— 实际列数看头字段 `结果列数`(见 columnsForResultCount)。 */
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

/** 检验项所在的标准库编码(与原表「检验项为数据库选择」对应)。
 *  ⚠ 2026-11-12 用户口径「检验项现在是带入的,不需要标准库维护」⇒ **面板不再提供维护入口**;
 *  这个库本身保留:历史检验项仍是下拉候选(回显/再选),新条目由「带入检验要求」带出。 */
export const QC_INSP_ITEM_LIB = 'qc.insp_item'

/**
 * Excel 导出用的列定义:结果列**按该单的实际列数**取前 n 列(不是物理列的 20 列全铺)。
 * 与纸面同一份真源:纸面显示几列,导出就几列(张单据的列数在头字段 `结果列数`)。
 * @param {number} [count] 结果列数;不传按默认 5 列
 */
export function columnsForResultCount(count = QC_INSP_REC_DEFAULT_RESULT_COLS) {
  return [
    { label: '检验项', key: '检验项', width: 18, lib: QC_INSP_ITEM_LIB },
    { label: '检测标准', key: '检测标准', width: 24 },
    { label: '检验方法', key: '检验方法', width: 24 },
    ...activeResultKeys(count).map((k, i) => ({ label: k, key: k, width: 10, result: i + 1 })),
    { label: '单项判定', key: '单项判定', width: 12 },
  ]
}

/** Excel 导出:表头行 + 一行取值(调用方应传该单的 结果列数;不传按默认 5 列) */
export function exportHeaderRow(count = QC_INSP_REC_DEFAULT_RESULT_COLS) {
  return columnsForResultCount(count).map((c) => c.label)
}
export function exportRow(row, count = QC_INSP_REC_DEFAULT_RESULT_COLS) {
  return columnsForResultCount(count).map((c) => (row ? row[c.key] : ''))
}
