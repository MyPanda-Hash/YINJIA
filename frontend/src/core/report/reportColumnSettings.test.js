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
