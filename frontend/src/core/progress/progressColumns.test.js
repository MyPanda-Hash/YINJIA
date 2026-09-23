import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PROGRESS_COLUMNS,
  RD_PROGRESS_DETAIL_COLUMNS,
  RD_PROGRESS_DETAIL_LABELS,
  columnByLabel,
  dataKeyOf,
  readCell,
} from './progressColumns.js'

/**
 * 控制列表的列序基线 —— 回归基线。
 *
 * 2026-09-22 用户口径(拿设计截图确认):控制列表是 **14 列**。
 * 设计文件 `二三级四级项目控制表2026.xlsx` 的表头行是 18 格,多出的 4 格为:
 *   开发复杂度 / 重要程度 / 紧急程度 —— 每行都填着占位符 `n n n`(从未有真实数据;
 *     三列物理列由 migrate-rd-progress-18cols.sql 新增,无旧列对应)
 *   项目定及变更 —— 18cols 迁移为承接「设计 O 列(状态)的手填说明」而建;用户确认不上控制列表
 *     (物理列与已回填的数据都保留,只是不占纸面)
 */
const DESIGN_LABELS = [
  '项目定级', '项目名称', '子项目/尺寸', '项目编号', '内容',
  '项目发起人', '项目负责人', '立项日期', '预计完成日期', '状态',
  '测试情况', '技术目标达成', '是否市场转化', '未转换原因',
]

/** 不上控制列表、但保留在明细元数据里的列(不参与纸面,数据不删) */
const OFF_SHEET_LABELS = ['开发复杂度', '重要程度', '紧急程度', '项目定及变更']

/**
 * 这条断言守的是 2026-09-10 那个 bug:
 * 前端拿"显示名"当数据键 → 后端按元数据过滤 → 值保存时被静默丢弃。
 * 2026-09-22 修正判据:后端认可的键是 **yj_field.label**(QueryService.rowToLabels 用
 * `row.get(f.label())` 输出、ButtonService.labelsToCols 用 `row.get(f.label())` 取值),
 * 所以要比的是**字段 label 清单**(RD_PROGRESS_DETAIL_LABELS),不是物理列清单
 * —— 用后者会让「项目定级」(label=项目定级 / 物理列=项目层级) 这类列漏网。
 */
test('每个可落库列的 key 必须是 RD_PROGRESS 明细字段的 label(后端按 label 收发)', () => {
  const bad = PROGRESS_COLUMNS
    .filter((c) => !RD_PROGRESS_DETAIL_LABELS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [], `以下列的 key 不是任何明细字段的 label,后端按 label 取不到值 ⇒ 读空+写丢弃:\n  ${bad.join('\n  ')}`)
})

test('列数固定为 14(用户 2026-09-22 口径),显示名与设计逐字一致且顺序相同', () => {
  assert.equal(PROGRESS_COLUMNS.length, 14)
  assert.deepEqual(PROGRESS_COLUMNS.map((c) => c.label), DESIGN_LABELS)
  assert.equal(new Set(PROGRESS_COLUMNS.map((c) => c.label)).size, 14)
  // 那 4 列必须彻底不在控制列表里(否则又会多出列)
  const onSheet = PROGRESS_COLUMNS.map((c) => c.label)
  for (const off of OFF_SHEET_LABELS) {
    assert.ok(!onSheet.includes(off), `${off} 不应出现在控制列表`)
    // 但明细元数据(:yj_field detail 字段)仍保留(数据不删,保存链/历史数据不受影响)
    assert.ok(RD_PROGRESS_DETAIL_LABELS.includes(off), `${off} 应保留在明细字段里`)
  }
})

/**
 * 2026-09-18 二次重构后**不再有 pendingAlign** ——
 * 上一轮为不改库结构而让 3 列只显示不落库,本轮已补齐物理列。
 * 这条断言防止将来有人又用 pendingAlign 做临时妥协而不留痕。
 */
test('不再有 pendingAlign 列(3 列已全部真落库)', () => {
  const pending = PROGRESS_COLUMNS.filter((c) => c.pendingAlign).map((c) => c.label)
  assert.deepEqual(pending, [], `这些列又被标成"只显示不落库": ${pending.join(', ')}`)
})

test('明细字段清单包含设计 14 列 + 4 个不上纸面的列 + 4 个内部列', () => {
  for (const label of DESIGN_LABELS) {
    // 每列都必须能经 K 映射找到落库键(即 key 在字段 label 清单里)
    assert.ok(columnByLabel(label), `缺列定义: ${label}`)
  }
  for (const internal of ['说明', '谁来批准', '谁来检验', '未批准原因']) {
    assert.ok(RD_PROGRESS_DETAIL_LABELS.includes(internal), `缺内部列: ${internal}`)
    assert.ok(RD_PROGRESS_DETAIL_COLUMNS.includes(internal), `缺内部物理列: ${internal}`)
  }
})

/**
 * 界面显示名(key 之外的那个 label)与落库键的关系 —— 逐列钉死,防止将来误改一侧造成静默丢值。
 *
 * 2026-09-22 修正:落库键 = yj_field.label,而 yj_field 里这些字段的 label 仍是**旧名**
 * (项目负责/实施进度/里程完成/测试员/项目级),界面按最新设计显示新名(项目负责人/立项日期/…),
 * 于是这 5 列显示名 ≠ key。「项目定级」此前被误写成物理列名 `项目层级`(读空+写丢弃),
 * 现已改为 '项目定级' —— 它与设计显示名同名,不再属于这组。
 */
test('显示名≠落库键的列恰好是那 5 处历史遗留(元数据 label 仍是旧名)', () => {
  const legacy = {
    项目发起人: '项目级',
    项目负责人: '项目负责',
    立项日期: '实施进度',
    预计完成日期: '里程完成',
    测试情况: '测试员',
  }
  const actual = Object.fromEntries(
    PROGRESS_COLUMNS.filter((c) => c.key !== c.label).map((c) => [c.label, c.key]),
  )
  assert.deepEqual(actual, legacy, '显示名≠落库键的列集合与预期不符')
})

/**
 * 带 alias 的列必须让**旧模板导出的 Excel 仍能落库**:readCell 依次试 label → alias。
 * 本表的 alias 是"另一套表头写法"的兜底,与 key 无关(2026-09-22 起不再用 key≠label 过滤)。
 */
test('需要兜底的列 alias 恰好是这批旧表头写法', () => {
  const expected = {
    项目定级: ['项目等级'],                    // 旧版界面/导入表头叫「项目等级」
    '子项目/尺寸': ['子项目尺寸'],
    项目编号: ['说明'],
    项目发起人: ['项目发起人'],
    项目负责人: ['项目负责人'],
    立项日期: ['立项日期'],
    预计完成日期: ['预计完成日期'],
    测试情况: ['测试情况'],
  }
  const actual = Object.fromEntries(
    PROGRESS_COLUMNS.filter((c) => c.alias).map((c) => [c.label, c.alias]),
  )
  assert.deepEqual(actual, expected, '带 alias 的列集合与预期不符')
})

test('readCell:显示名优先,旧模板表头(alias)兜底', () => {
  // 显示名 = 设计表头,优先
  assert.equal(readCell({ '子项目/尺寸': 'L2' }, '子项目/尺寸'), 'L2')
  assert.equal(readCell({ 项目编号: 'YJ-XS002' }, '项目编号'), 'YJ-XS002')
  assert.equal(readCell({ 项目定级: '二级' }, '项目定级'), '二级')
  // 旧模板表头兜底(alias)
  assert.equal(readCell({ 项目等级: '三级' }, '项目定级'), '三级')
  assert.equal(readCell({ 子项目尺寸: 'L3' }, '子项目/尺寸'), 'L3')
  assert.equal(readCell({ 说明: 'YJ-XS001' }, '项目编号'), 'YJ-XS001')
  // 键不存在 → undefined(不抛)
  assert.equal(readCell({}, '项目编号'), undefined)
  assert.equal(readCell(null, '项目编号'), undefined)
  assert.equal(readCell({ x: 1 }, '不存在的列'), undefined)
})

test('dataKeyOf:每列都返回真实落库键(=字段 label,后端按它收发)', () => {
  assert.equal(dataKeyOf('项目定级'), '项目定级')     // 物理列是「项目层级」,但载荷键必须用 label
  assert.equal(dataKeyOf('项目负责人'), '项目负责')
  assert.equal(dataKeyOf('预计完成日期'), '里程完成')
  assert.equal(dataKeyOf('技术目标达成'), '技术目标达成')   // 本轮起真落库
  assert.equal(dataKeyOf('是否市场转化'), '是否市场转化')
  assert.equal(dataKeyOf('未转换原因'), '未转换原因')
  assert.equal(dataKeyOf('不存在的列'), null)
})

/**
 * 源码级回归:组件里**不允许**把"显示名"当作数据键写进对象字面量。
 * 2026-09-10 踩过:批量把 row['X'] 改成 row[K['X']] 时漏了 { '项目等级': lv } 这种
 * 对象字面量写法,结果"新增项目"建出来的行等级键仍是显示名 → 保存被丢弃 + 同等级块查找失效。
 * 这条断言直接扫组件源码,把这一类"漏替换"钉死。
 */
test('组件源码里不得把显示名当对象字面量的数据键', () => {
  const src = readFileSync(new URL('../views/ProgressControlSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const col of PROGRESS_COLUMNS) {
    // 显示名与数据键本来就相同的列不受此约束
    if (col.key === col.label) continue
    if (new RegExp(`'${escapeRe(col.label)}'\\s*:`).test(src)) bad.push(`${col.label} (应为 ${col.key})`)
  }
  assert.deepEqual(bad, [], `组件里仍把显示名当数据键,保存会被丢弃:\n  ${bad.join('\n  ')}`)
})

test('组件源码里不得出现裸的显示名方括号取值(必须经 K 映射)', () => {
  const src = readFileSync(new URL('../views/ProgressControlSheet.vue', import.meta.url), 'utf8')
  const bad = []
  for (const col of PROGRESS_COLUMNS) {
    if (new RegExp(`(?<!K)\\['${escapeRe(col.label)}'\\]`).test(src)) bad.push(col.label)
  }
  assert.deepEqual(bad, [], `这些列仍用显示名直接取值: ${bad.join(', ')}`)
})

/** 正则转义(中文标签里含 / 等字符) */
function escapeRe(s) {
  return s.replace(/[.*+?^$${}()|[\]\\]/g, '\\$&')
}
