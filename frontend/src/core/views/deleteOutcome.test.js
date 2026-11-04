import test from 'node:test'
import assert from 'node:assert/strict'
import { deleteOutcome } from './deleteOutcome.js'

/**
 * 「删除」结果提示(2026-11-04 用户报障):
 *   「使用陈秀丽的账号删除单据的时候显示删除成功了,但是实际上还没有删除成功,
 *     我使用管理员账号删除之后才删掉的」
 *
 * 服务端的真实语义(ButtonService.deleteDocFile):
 *   · 草稿            ⇒ voidDoc,直接作废(真删了)
 *   · 已归档 + 管理员  ⇒ voidDoc,直接作废(真删了)
 *   · 已归档 + 非管理员 ⇒ 只写 deleting='Y',状态「删除申请中」,**没有删**
 *
 * 所以提示必须**跟着服务端回写的状态走**,任何情况下都不许无条件报"已删除"。
 */

test('已作废 ⇒ 成功:单据确实删了(草稿删除 / 管理员删归档)', () => {
  const r = deleteOutcome('已作废')
  assert.equal(r.level, 'success')
  assert.equal(r.key, '单据已删除')
})

test('删除申请中 ⇒ 警告:只是提交了申请,**没有删**(陈秀丽那次就是这个)', () => {
  const r = deleteOutcome('删除申请中')
  assert.equal(r.level, 'warning', '不能报成功 —— 这正是"显示删除成功但没删掉"的根源')
  assert.ok(r.key.includes('待管理员审批'), '文案必须说清"要等审批"')
  assert.ok(r.key.includes('才会真正删除'), '文案必须说清"现在还没删"')
})

test('服务端没回状态 ⇒ 如实说"已提交",绝不谎报"已删除"', () => {
  const r = deleteOutcome(undefined)
  assert.notEqual(r.level, 'success')
  assert.ok(!r.key.includes('单据已删除'))
  const empty = deleteOutcome('')
  assert.notEqual(empty.level, 'success')
})

test('未知状态(如老 jar 回了个别的词)⇒ 带出来给用户看,不静默', () => {
  const r = deleteOutcome('已审核')
  assert.equal(r.level, 'info')
  assert.equal(r.fallback, '（已审核）')
})

test('前后空白不影响判定(服务端字符串可能带空格)', () => {
  assert.equal(deleteOutcome(' 已作废 ').level, 'success')
  assert.equal(deleteOutcome(' 删除申请中 ').level, 'warning')
})

test('null 不炸', () => {
  assert.doesNotThrow(() => deleteOutcome(null))
  assert.notEqual(deleteOutcome(null).level, 'success')
})
