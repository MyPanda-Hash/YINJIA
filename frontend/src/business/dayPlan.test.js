import test from 'node:test'
import assert from 'node:assert/strict'
import { diffPlan, qtyText, isPast } from './dayPlan.js'

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
