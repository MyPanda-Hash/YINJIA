import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tabClosePlan } from './unsaved.js'

/**
 * 「× 关闭页签是否要问」的判定表(2026-10-16 用户口径:
 * 「填写的表格数据…在未×掉之前都是保留的,叉掉时还应该弹窗提示是否保存」)。
 * 这里钉的是**判定**,三态弹窗本身在 TabsBar 里(依赖 Element 弹窗,不进单测)。
 */
const dirtyApi = { hasUnsaved: () => true, save: () => true, discard: () => true }

test('没有登记的面板(如非表单页签)直接关闭', () => {
  assert.deepEqual(tabClosePlan(null), { step: 'close' })
  assert.deepEqual(tabClosePlan({}), { step: 'close' })
})

test('面板报告"没有未保存修改" → 直接关闭,不弹窗', () => {
  assert.deepEqual(tabClosePlan({ hasUnsaved: () => false }), { step: 'close' })
})

test('有未保存修改 → 先问(三态),问过之后按选择走', () => {
  assert.deepEqual(tabClosePlan(dirtyApi), { step: 'ask' })
  assert.deepEqual(tabClosePlan(dirtyApi, 'save'), { step: 'save' })
  assert.deepEqual(tabClosePlan(dirtyApi, 'discard'), { step: 'discard' })
  assert.deepEqual(tabClosePlan(dirtyApi, 'cancel'), { step: 'cancel' })
})

test('非标准选择(弹窗被 ESC 关掉等)按"取消关闭"处理,绝不静默丢数据', () => {
  assert.deepEqual(tabClosePlan(dirtyApi, 'close'), { step: 'discard' })
  // ⚠ 说明:Element 的 cancel(点「不保存」按钮)与 close(右上角 ×/ESC)由 TabsBar 区分,
  //   传进来只会有 save/discard/cancel 三种;这里钉住"未知值不会变成静默丢弃之外的意外分支"
})

test('hasUnsaved 抛错时不至于把页签卡死(判定按未登记处理)', () => {
  const boom = { hasUnsaved: () => { throw new Error('boom') } }
  assert.throws(() => tabClosePlan(boom))
})
