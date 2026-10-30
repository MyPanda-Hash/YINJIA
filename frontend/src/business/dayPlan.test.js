import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSplit, diffPlan, qtyText, isPast } from './dayPlan.js'

test('均摊:整除时每天相同', () => {
  const r = buildSplit(3000, '2026-10-29', '2026-10-31')
  assert.deepEqual(r, { '2026-10-29': 1000, '2026-10-30': 1000, '2026-10-31': 1000 })
})

test('均摊:除不尽余数给最后一天,合计守恒', () => {
  const r = buildSplit(3000, '2026-10-29', '2026-11-04')
  const days = Object.keys(r)
  assert.equal(days.length, 7)
  assert.equal(days.reduce((a, d) => a + r[d], 0), 3000)
  assert.equal(r['2026-11-04'], 3000 - 428 * 6)
})

test('均摊:起止同一天 = 全给当天', () => {
  assert.deepEqual(buildSplit(1500, '2026-10-29', '2026-10-29'), { '2026-10-29': 1500 })
})

test('均摊:数量<=0 或完工日早于起点 → 空', () => {
  assert.deepEqual(buildSplit(0, '2026-10-29', '2026-11-01'), {})
  assert.deepEqual(buildSplit(100, '2026-11-02', '2026-11-01'), {})
})

test('diffPlan:只回改动格(含清空)', () => {
  const orig = { '2026-10-30': 500, '2026-10-31': 500 }
  const cur = { '2026-10-30': 600, '2026-10-31': 0 }
  const diff = diffPlan(orig, cur, ['2026-10-30', '2026-10-31', '2026-11-01'])
  assert.deepEqual(diff, [
    { 日期: '2026-10-30', 数量: 600 },
    { 日期: '2026-10-31', 数量: 0 },
  ])
})

test('qtyText:0 显示空白', () => {
  assert.equal(qtyText(0), '')
  assert.equal(qtyText(null), '')
  assert.equal(qtyText(1500), '1500')
  assert.equal(qtyText(1500.5), '1500.5')
})

test('isPast:今天不算过去', () => {
  assert.equal(isPast('2026-10-28', '2026-10-29'), true)
  assert.equal(isPast('2026-10-29', '2026-10-29'), false)
})
