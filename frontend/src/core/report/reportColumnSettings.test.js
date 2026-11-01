import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportColumnSettings,
  sortReportRows,
  visibleReportColumns
} from './reportColumnSettings.js'

test('builds visible report columns from persisted settings', () => {
  const settings = buildReportColumnSettings(
    ['仓库', '金额', '数量'],
    { columns: [{ prop: '金额', label: '总金额', visible: false }] }
  )
  assert.deepEqual(visibleReportColumns(settings), ['仓库', '数量'])
  assert.equal(settings.find((item) => item.prop === '金额').label, '总金额')
})

// 2026-10-29:列设置支持「调整列顺序」⇒ 已保存 columns[] 的顺序即用户调好的顺序
test('saved column order wins; new columns append in default order', () => {
  const settings = buildReportColumnSettings(
    ['a', 'b', 'c', 'd'],
    { columns: [{ prop: 'c', label: 'c', visible: true }, { prop: 'a', label: 'a', visible: true }] }
  )
  // c、a 按保存顺序在前;b、d 是保存里没有的新列,按默认顺序补在后面
  assert.deepEqual(settings.map((s) => s.prop), ['c', 'a', 'b', 'd'])
  assert.ok(settings.every((s) => s.visible))
})

test('saved settings: unknown props dropped, duplicates deduped, visible=false only', () => {
  const settings = buildReportColumnSettings(
    ['a', 'b'],
    { columns: [{ prop: 'zzz', visible: true }, { prop: 'b', visible: false }, { prop: 'b', visible: true }] }
  )
  assert.deepEqual(settings.map((s) => s.prop), ['b', 'a'])
  assert.equal(settings.find((s) => s.prop === 'b').visible, false)
  assert.equal(settings.find((s) => s.prop === 'a').visible, true)
})

test('sorts report rows ascending and descending', () => {
  const rows = [{ 金额: 20 }, { 金额: 3 }, { 金额: 11 }]
  assert.deepEqual(
    sortReportRows(rows, { prop: '金额', order: 'asc' }).map((r) => r.金额),
    [3, 11, 20]
  )
  assert.deepEqual(
    sortReportRows(rows, { prop: '金额', order: 'desc' }).map((r) => r.金额),
    [20, 11, 3]
  )
})

test('empty sort config keeps original order', () => {
  const rows = [{ a: 2 }, { a: 1 }]
  assert.deepEqual(
    sortReportRows(rows, {}).map((r) => r.a),
    [2, 1]
  )
})
