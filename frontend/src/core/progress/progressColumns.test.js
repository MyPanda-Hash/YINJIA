import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROGRESS_COLUMNS,
  RD_PROGRESS_DETAIL_COLUMNS,
  columnByLabel,
  dataKeyOf,
  readCell,
} from './progressColumns.js'

/**
 * 这条断言守的是 2026-09-10 那个 bug:
 * 前端拿"显示名"当数据键 → 后端按元数据过滤 → 值保存时被静默丢弃。
 * 只要某个 key 不在 RD_PROGRESS 明细列里,保存就一定丢,必须在这里拦住。
 */
test('每个可落库列的 key 必须存在于 RD_PROGRESS 明细元数据列里', () => {
  const bad = PROGRESS_COLUMNS
    .filter((c) => !c.pendingAlign)
    .filter((c) => !RD_PROGRESS_DETAIL_COLUMNS.includes(c.key))
    .map((c) => `${c.label}(key=${c.key})`)
  assert.deepEqual(bad, [], `以下列的落库键不在 rd_progress_detail / yj_field 里,保存会被丢弃:\n  ${bad.join('\n  ')}`)
})

test('列数固定为 14,且显示名不重复', () => {
  assert.equal(PROGRESS_COLUMNS.length, 14)
  assert.equal(new Set(PROGRESS_COLUMNS.map((c) => c.label)).size, 14)
})

/**
 * 尚未与元数据对齐的列必须**显式标记** pendingAlign,
 * 这样它们不会被误当成"能落库",将来对齐时也必须来改这个数字。
 */
test('暂未对齐的列必须显式标记,且数量被钉住(当前 3 列)', () => {
  const pending = PROGRESS_COLUMNS.filter((c) => c.pendingAlign).map((c) => c.label)
  assert.deepEqual(pending, ['技术目标达成', '是否市场转化', '未转换原因'])
})

test('已对齐列的 key 不应等于显示名(否则说明还没改名)', () => {
  // 允许真正同名的那几列:项目名称 / 子项目/尺寸 / 内容 / 状态
  const sameName = ['项目名称', '子项目/尺寸', '内容', '状态']
  const suspicious = PROGRESS_COLUMNS
    .filter((c) => !c.pendingAlign && !sameName.includes(c.label))
    .filter((c) => c.key === c.label)
    .map((c) => c.label)
  assert.deepEqual(suspicious, [], `这些列仍在用显示名当数据键: ${suspicious.join(', ')}`)
})

test('dataKeyOf:未对齐列返回 null(只显示不落库)', () => {
  assert.equal(dataKeyOf('项目负责人'), '项目负责')
  assert.equal(dataKeyOf('预计完成日期'), '里程完成')
  assert.equal(dataKeyOf('技术目标达成'), null)
  assert.equal(dataKeyOf('不存在的列'), null)
})

test('readCell:兼容历史 Excel 表头别名', () => {
  assert.equal(readCell({ 子项目尺寸: 'L3' }, '子项目/尺寸'), 'L3')
  assert.equal(readCell({ '子项目/尺寸': 'L2' }, '子项目/尺寸'), 'L2')
  assert.equal(readCell({ 项目负责人: '陈秀丽' }, '项目负责人'), '陈秀丽')
  assert.equal(columnByLabel('测试情况').key, '测试员')
})
