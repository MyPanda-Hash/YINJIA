/**
 * puPrintAmount.test.js — 采购订单打印弹窗「小计」口径单测(2026-11-07)
 *
 * 钉住:数量没改 ⇒ 沿用订单原金额(折扣/分摊不能被打印抹掉);改了 ⇒ 单价×数量(4 位小数);
 * 缺单价 ⇒ 无法重算,退回原金额。服务端 PuPrintService 按同一口径落库,两边必须一致。
 * 运行:npm test(node --test)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const { puOrderLineAmount } = await import('./puPrintAmount.js')

test('puOrderLineAmount:数量没改取原金额,改了取 单价×数量', () => {
  // 带折扣的行:金额 80 ≠ 单价×数量 100 —— 没改数量时必须保留 80
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10, 金额: 80 }, 10), 80, '没改数量 ⇒ 原金额')
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10, 金额: 80 }, 5), 50, '改了数量 ⇒ 10×5=50')
  assert.equal(puOrderLineAmount({ 数量: 5000, 单价: 0.077, 金额: 385 }, 1234), 95.018, '0.077×1234=95.018')
})

test('puOrderLineAmount:4 位小数收口(decimal(18,4) 同口径)', () => {
  assert.equal(puOrderLineAmount({ 数量: 1, 单价: 1.23456 }, 2.3456), 2.8958, '1.23456×2.3456=2.895783936 → 2.8958')
})

test('puOrderLineAmount:缺单价退回原金额;没有原金额就按 单价×数量 算', () => {
  assert.equal(puOrderLineAmount({ 数量: 10, 金额: 80 }, 5), 80, '没有单价 ⇒ 无法重算,退回原金额')
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10 }, 5), 50, '没有原金额但有单价 ⇒ 算出 50')
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10, 金额: 100 }, ''), 100, '空数量 ⇒ 视为没改')
})
