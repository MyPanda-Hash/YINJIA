import test from 'node:test'
import assert from 'node:assert/strict'
import { specCarryFailure } from './specCarry.js'

/**
 * 「自动填充规格书」的失败口径(2026-09-21 用户口径):
 *   出货检验计划表选产品编号时按规格书自动带入检验方法,**但必须规格书已经填写并提交审批完**。
 *   后端 /px/specByProduct 在规格书没审批完时返回 { found:false, reason:'not_approved', 规格书编号, 规格书状态 },
 *   界面据此说清"是哪一张、什么状态",而不是一句含糊的"没有规格书"。
 */

test('规格书可用(found=true) ⇒ 没有失败口径', () => {
  assert.equal(specCarryFailure({ found: true, 单据编号: 'SD-1' }), null)
})

test('规格书未审批完 ⇒ not_approved,并带上是哪一张、什么状态', () => {
  assert.deepEqual(
    specCarryFailure({ found: false, reason: 'not_approved', 规格书编号: 'SD-2026-09-0042', 规格书状态: '草稿' }),
    { kind: 'not_approved', specNo: 'SD-2026-09-0042', status: '草稿' },
  )
})

test('审批中的规格书同样算未审批完(状态原样带出)', () => {
  const r = specCarryFailure({ found: false, reason: 'not_approved', 规格书编号: 'SD-2', 规格书状态: '审批中' })
  assert.equal(r.kind, 'not_approved')
  assert.equal(r.status, '审批中')
})

test('压根没有规格书(没有 reason / 空 payload / null)⇒ no_spec', () => {
  assert.equal(specCarryFailure({ found: false }).kind, 'no_spec')
  assert.equal(specCarryFailure({}).kind, 'no_spec')
  assert.equal(specCarryFailure(null).kind, 'no_spec')
})

test('not_approved 但编号/状态缺失也不炸(给空串)', () => {
  assert.deepEqual(specCarryFailure({ found: false, reason: 'not_approved' }), { kind: 'not_approved', specNo: '', status: '' })
})
