import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportColumnSettings,
  columnPinOf,
  groupColumnsByPin,
  normalizePin,
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

// ── 2026-11-18 列设置「固定列位置」────────────────────────────────────────────────
test('normalizePin:只认 left/right,其余一律不固定', () => {
  assert.equal(normalizePin('left'), 'left')
  assert.equal(normalizePin('right'), 'right')
  assert.equal(normalizePin(''), '')
  assert.equal(normalizePin(undefined), '')
  assert.equal(normalizePin('center'), '')
  assert.equal(normalizePin(true), '')
})

test('buildReportColumnSettings:显式保存的 pin 原样带入,没存过的不写 pin 键(留给页面默认)', () => {
  const settings = buildReportColumnSettings(
    ['a', 'b', 'c'],
    { columns: [{ prop: 'a', visible: true, pin: 'left' }, { prop: 'b', visible: true, pin: '' }, { prop: 'c', visible: true }] }
  )
  assert.equal(settings.find((s) => s.prop === 'a').pin, 'left')
  // 显式空串 = 用户主动取消固定(不能被页面默认又盖回去)
  assert.equal(settings.find((s) => s.prop === 'b').pin, '')
  // 老设置没有 pin 键 ⇒ 草稿里也不写,由 columnPinOf 的 defaults 决定
  assert.ok(!Object.prototype.hasOwnProperty.call(settings.find((s) => s.prop === 'c'), 'pin'))
})

test('columnPinOf:设置显式值优先,未设置回落页面默认', () => {
  const defaults = { 产品编码: 'left' }
  assert.equal(columnPinOf({ prop: '产品编码', pin: 'right' }, defaults), 'right')
  assert.equal(columnPinOf({ prop: '产品编码', pin: '' }, defaults), '', '显式取消固定要生效')
  assert.equal(columnPinOf({ prop: '产品编码' }, defaults), 'left', '没存过 ⇒ 用默认固定')
  assert.equal(columnPinOf('客户', defaults), '')
  assert.equal(columnPinOf({ prop: '客户' }), '')
})

test('groupColumnsByPin:固定左 → 不固定 → 固定右,同组内保持传入顺序', () => {
  const out = groupColumnsByPin([
    { prop: 'a' },
    { prop: 'b', pin: 'right' },
    { prop: 'c', pin: 'left' },
    { prop: 'd', pin: 'left' },
    { prop: 'e' },
    { prop: 'f', pin: 'right' },
  ])
  assert.deepEqual(out.map((c) => c.prop), ['c', 'd', 'a', 'e', 'b', 'f'])
  assert.deepEqual(out.filter((c) => c.fixed === 'left').map((c) => c.prop), ['c', 'd'])
  assert.deepEqual(out.filter((c) => c.fixed === 'right').map((c) => c.prop), ['b', 'f'])
})
