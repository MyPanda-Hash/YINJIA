/**
 * 项目进度查询(RD_PROGRESS)控制列表 —— 列定义的唯一真源。
 *
 * 【为什么必须把"显示名"和"数据键"分开】
 * 这个面板是一张手写表格:表头是业务显示名(项目负责人 / 立项日期 / …),
 * 但写进 detail 行的 **数据键必须是 RD_PROGRESS 的元数据列名**
 * (yj_field.col_name,也就是 rd_progress_detail 的物理列名)。
 * 后端 ButtonService.saveXxx 对明细行执行 labelsToCols(def.fields(), item),
 * 只映射元数据里存在的标签,其余键在保存时被**静默丢弃**。
 *
 * 【历史坑,2026-09-10 修复】
 * 此前前端一直拿"显示名"当数据键,于是除 项目名称 / 子项目/尺寸 / 内容 / 状态 之外
 * 的 10 列全部丢库 —— 表现就是用户报的
 * 「项目实施计划和项目进度查询的自动导入没有实现,出现了偏差」:
 * 自动导入写的「预计完成日期」「项目负责人」保存后消失,手填的那些列同样消失。
 *
 * 所以:**新增/修改列时,key 必须能在 RD_PROGRESS_DETAIL_COLUMNS 里找到**,
 * 由 progressColumns.test.js 守住这条线。
 */

/**
 * RD_PROGRESS 明细侧的元数据列名(yj_field where panel_code='RD_PROGRESS' and place='detail'),
 * 与物理表 rd_progress_detail 的列一一对应。改库时必须同步改这里。
 */
export const RD_PROGRESS_DETAIL_COLUMNS = Object.freeze([
  '项目名称', '项目层级', '子项目/尺寸', '说明', '内容', '项目级', '项目负责',
  '实施进度', '里程完成', '状态', '测试员', '谁来批准', '谁来检验', '未批准原因',
])

/**
 * 控制列表的 14 列。
 * - `label`:界面表头与 Excel 表头的显示名(业务语言,可多语言)
 * - `key`  :落库数据键,必须在 RD_PROGRESS_DETAIL_COLUMNS 里
 * - `alias`:Excel 导入时额外接受的历史表头别名
 * - `pendingAlign`:该列尚未与元数据对齐(显示名被临时当作数据键),只显示不落库
 */
export const PROGRESS_COLUMNS = Object.freeze([
  { label: '项目等级', key: '项目层级', width: 10 },
  { label: '项目名称', key: '项目名称', width: 20 },
  { label: '子项目/尺寸', key: '子项目/尺寸', width: 22, alias: ['子项目尺寸'] },
  { label: '项目编号', key: '说明', width: 12 },
  { label: '内容', key: '内容', width: 30 },
  { label: '项目发起人', key: '项目级', width: 10 },
  { label: '项目负责人', key: '项目负责', width: 12 },
  { label: '立项日期', key: '实施进度', width: 11 },
  { label: '预计完成日期', key: '里程完成', width: 12 },
  { label: '状态', key: '状态', width: 20, readonly: true },
  { label: '测试情况', key: '测试员', width: 34 },
  { label: '技术目标达成', key: '技术目标达成', width: 12, pendingAlign: true },
  { label: '是否市场转化', key: '是否市场转化', width: 12, pendingAlign: true },
  { label: '未转换原因', key: '未转换原因', width: 16, pendingAlign: true },
])

/** 按显示名取列定义 */
export function columnByLabel(label) {
  return PROGRESS_COLUMNS.find((c) => c.label === label) || null
}

/** 该列的落库键:未对齐的列返回 null(仅显示,不写库) */
export function dataKeyOf(label) {
  const col = columnByLabel(label)
  if (!col || col.pendingAlign) return null
  return col.key
}

/** Excel 导入:从一行里取该列的值(兼容历史表头别名) */
export function readCell(row, label) {
  const col = columnByLabel(label)
  if (!col) return undefined
  const names = [col.label, ...(col.alias || [])]
  for (const n of names) {
    if (row && Object.prototype.hasOwnProperty.call(row, n)) return row[n]
  }
  return undefined
}
