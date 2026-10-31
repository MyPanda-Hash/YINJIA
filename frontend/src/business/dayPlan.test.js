import test from 'node:test'
import assert from 'node:assert/strict'
import { diffPlan, qtyText, isPast, isOverCapacity, unplannedQty } from './dayPlan.js'

// ⚠ 2026-10-30:「按完工日期均摊」已按用户口径删除(buildSplit 一并删除),
//   这里只保留仍在用的纯函数测试。日计划改为手工逐格填写 + 保存。

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

test('isOverCapacity:超产能只用于显示;未配产能(<=0)不判', () => {
  assert.equal(isOverCapacity(12000, 11000), true)
  assert.equal(isOverCapacity(11000, 11000), false) // 刚好排满不算超
  assert.equal(isOverCapacity(0, 11000), false)
  assert.equal(isOverCapacity(12000, 0), false)     // 未配产能 = 不判超载
  assert.equal(isOverCapacity(12000, null), false)
})

test('unplannedQty:工序计划量 − 已分;取不到口径返回 null', () => {
  assert.equal(unplannedQty(15000, 12000), 3000)   // 还没分完
  assert.equal(unplannedQty(15000, 15000), 0)      // 分完了
  assert.equal(unplannedQty(15000, 15200), -200)   // 历史脏数据:分超了(后端保存有闸,正常不会出现)
  assert.equal(unplannedQty(0, 500), null)         // 取不到工序计划量 ⇒ 显示 "-",不算负数
  assert.equal(unplannedQty(null, 500), null)
})
