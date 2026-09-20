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
 * 【2026-09-18 二次重构:对齐设计《二三级四级项目控制表2026》18 列】
 * 上一轮只做到"6 列把显示名映射到语义无关的物理列"——为不改库结构而做的临时妥协:
 *     立项日期↔实施进度、测试情况↔测试员、项目编号↔说明、
 *     预计完成日期↔里程完成、项目负责人↔项目负责、项目发起人↔项目级
 * 另有 3 列标 pendingAlign(只显示不落库)。
 * 本轮按设计补齐物理列(migrate-rd-progress-18cols.sql),**显示名与数据键 1:1 对齐,
 * 不再有 pendingAlign、不再有错位**。所以下面 6 处 alias 是**历史表头兼容**(旧 Excel
 * 导入模板用的列名),不是错位映射。
 *
 * 改库时必须同步改这里 + progressColumns.test.js 会守住这条线。
 */

/**
 * RD_PROGRESS 明细侧的元数据列名(yj_field where panel_code='RD_PROGRESS' and place='detail'),
 * 与物理表 rd_progress_detail 的列一一对应。
 * 前 18 项 = 设计 18 列;后 3 项 = 内部列(保留,不进控制列表)。
 */
export const RD_PROGRESS_DETAIL_COLUMNS = Object.freeze([
  // ── 设计 18 列(顺序即设计 B..S 列序)──
  '项目层级',        // 设计列名「项目定级」(col_name 保持旧名,见下)
  '项目名称',
  '子项目/尺寸',
  '项目编号',
  '开发复杂度',
  '重要程度',
  '紧急程度',
  '内容',
  '项目级',          // 设计列名「项目发起人」
  '项目负责',        // 设计列名「项目负责人」
  '实施进度',        // 设计列名「立项日期」(col_name 保持旧名)
  '里程完成',        // 设计列名「预计完成日期」(col_name 保持旧名)
  '项目定及变更',
  '状态',
  '测试员',          // 设计列名「测试情况」
  '技术目标达成',
  '是否市场转化',
  '未转换原因',
  // ── 内部列(保留,不进控制列表)──
  '说明',
  '谁来批准',
  '谁来检验',
  '未批准原因',
])

/**
 * 控制列表的 18 列(顺序 = 设计原表 B5..S5 列序)。
 *
 * - `label`:界面表头与 Excel 表头的**设计显示名**(业务语言,可多语言)
 * - `key`  :落库数据键,必须在 RD_PROGRESS_DETAIL_COLUMNS 里
 * - `alias`:Excel 导入时**额外接受**的表头名(readCell 依次尝试 label → alias…)。
 *           分两类,都保留:
 *             ① 历史模板表头 —— 旧版导出的 Excel 用 `项目等级` / `子项目尺寸`,不认就该列丢空
 *             ② 旧物理列名   —— 2026-09-10 那轮"拿显示名当数据键"时期的表头(`说明`/`项目负责`…)
 *           ⚠ 本轮 6 处 label≠key 是**刻意的**:数据库列名是历史遗留
 *             (2026-09-18 决策:col_name 一律不改 —— 数据键永久不变,改则历史单据字段全丢),
 *             而界面按最新设计显示。
 * - `group`:该项目定级值相同的行在渲染时合并该列单元格(设计是纵向合并的行组)
 */
export const PROGRESS_COLUMNS = Object.freeze([
  { label: '项目定级',     key: '项目层级',     width: 8,  group: true, alias: ['项目等级'] },
  { label: '项目名称',     key: '项目名称',     width: 18 },
  { label: '子项目/尺寸',  key: '子项目/尺寸',  width: 20, alias: ['子项目尺寸'] },
  { label: '项目编号',     key: '项目编号',     width: 10, alias: ['说明'] },
  { label: '开发复杂度',   key: '开发复杂度',   width: 9 },
  { label: '重要程度',     key: '重要程度',     width: 8 },
  { label: '紧急程度',     key: '紧急程度',     width: 8 },
  { label: '内容',         key: '内容',         width: 28 },
  { label: '项目发起人',   key: '项目级',       width: 10, alias: ['项目发起人'] },
  { label: '项目负责人',   key: '项目负责',     width: 10, alias: ['项目负责人'] },
  { label: '立项日期',     key: '实施进度',     width: 10, alias: ['立项日期'] },
  { label: '预计完成日期', key: '里程完成',     width: 11, alias: ['预计完成日期'] },
  { label: '项目定及变更', key: '项目定及变更', width: 26 },
  { label: '状态',         key: '状态',         width: 18, readonly: true },
  { label: '测试情况',     key: '测试员',       width: 20, alias: ['测试情况'] },
  { label: '技术目标达成', key: '技术目标达成', width: 10 },
  { label: '是否市场转化', key: '是否市场转化', width: 10 },
  { label: '未转换原因',   key: '未转换原因',   width: 14 },
])

/** 按显示名取列定义 */
export function columnByLabel(label) {
  return PROGRESS_COLUMNS.find((c) => c.label === label) || null
}

/** 该列的落库键:找不到列定义返回 null(仅显示,不写库) */
export function dataKeyOf(label) {
  const col = columnByLabel(label)
  return col ? col.key : null
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
