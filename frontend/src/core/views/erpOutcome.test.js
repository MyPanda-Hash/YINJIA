import test from 'node:test'
import assert from 'node:assert/strict'
import { erpOutcome, erpOutcomeText, ERP_ALREADY_KEY } from './erpOutcome.js'

/**
 * 「转ERP」结果提示(2026-11-09 用户报障):
 *   「已转erp的要弃审后,重新审核后才可以转erp,但是现在可以直接转erp会一直显示转erp执行成功,
 *     应该需要已转的有已经转的提示。」
 *
 * 服务端的真实语义(KingdeePushService.pushDocument):
 *   · 是否已转ERP = 是 ⇒ 不推金蝶,原样返回 message='该单据已转入ERP，不可重复转入' + ERP单号
 *   · 未转且已审核     ⇒ 真推,push 成功后回写 是否已转ERP=是 + ERP单号
 *
 * 所以:已转必须弹 warning 并说清"要重转请先弃审再审核";成功才弹 success。
 */

test('已转(新服务端给 already=true)⇒ warning,带 ERP 单号与"弃审再审核"指引', () => {
  const o = erpOutcome({ 是否已转ERP: '是', ERP单号: 'CGRK-20261014-03407', already: true })
  assert.equal(o.already, true)
  assert.equal(o.level, 'warning', '不能报成功 —— 这正是"没弃审也说转成功了"的根源')
  assert.equal(o.erpNo, 'CGRK-20261014-03407')
  assert.equal(o.key, ERP_ALREADY_KEY)
  const text = erpOutcomeText(o, (s) => s)
  assert.ok(text.includes('CGRK-20261014-03407'), '文案要带出已有的 ERP 单号')
  assert.ok(text.includes('弃审') && text.includes('审核'), '文案要说清"要重转得先弃审再审核"')
})

test('老 jar 没有 already 标记 ⇒ 按文案里的「已转入ERP」认出来(部署过渡期必须成立)', () => {
  const o = erpOutcome({ 是否已转ERP: '是', ERP单号: 'X1', message: '该单据已转入ERP，不可重复转入' })
  assert.equal(o.already, true)
  assert.equal(o.level, 'warning')
})

test('推送成功 ⇒ success,且**不**能因为回写的 是否已转ERP=是 被误判成"已转"', () => {
  const o = erpOutcome({ 是否已转ERP: '是', ERP单号: 'CGRK-20260917-00033' })
  assert.equal(o.already, false, '成功推送也会回写 是,拿它当判据会把每次成功都误报成已转')
  assert.equal(o.level, 'success')
  assert.equal(o.key, '')
})

test('成功推送的 ERP 单号仍然带出来(调用方可用)', () => {
  assert.equal(erpOutcome({ ERP单号: ' CGRK-1 ' }).erpNo, 'CGRK-1', 'ERP 单号要去空白')
})

test('没有返回体(null/undefined/空对象)⇒ 不能当成已转,也不能炸', () => {
  for (const v of [null, undefined, {}]) {
    const o = erpOutcome(v)
    assert.equal(o.already, false)
    assert.equal(o.level, 'success')
  }
  assert.doesNotThrow(() => erpOutcome({ message: null, ERP单号: null }))
})

test('erpOutcomeText:未转时返回空串(调用方沿用原来的「执行成功」)', () => {
  assert.equal(erpOutcomeText(erpOutcome({ ERP单号: 'A' }), (s) => s), '')
  assert.equal(erpOutcomeText(null, (s) => s), '')
})

test('erpOutcomeText:没有 ERP 单号时用占位符,不留裸 {no}', () => {
  const text = erpOutcomeText(erpOutcome({ already: true }), (s) => s)
  assert.ok(!text.includes('{no}'))
  assert.ok(text.includes('—'))
})

test('erpOutcomeText:翻译函数生效(切英文后不出现中文)', () => {
  const text = erpOutcomeText(erpOutcome({ already: true, ERP单号: 'E1' }), () => 'Pushed to ERP ({no})')
  assert.equal(text, 'Pushed to ERP (E1)')
})
