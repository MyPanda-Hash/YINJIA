/**
 * puPrintRows.test.js — 采购订单「打印时编辑」落纸行单测(2026-11-07)
 *
 * 用户口径:「采购订单的打印(两个报表一个有金额,一个没有金额),需要能够在打印报表的时候编辑
 * (像打印材料码的编辑一样),要可以勾选打印和填写数量」。
 * 钉住三条:
 *   ① 没勾的行不打印;② 改了数量 ⇒ 小计=单价×本次数量(4 位小数);
 *   ③ 没改数量 ⇒ 沿用原金额(折扣/分摊后的金额不能被打印这一步抹掉),且原始明细不被改写。
 * 运行:npm test(node --test)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const { puOrderPrintRows, puOrderLineAmount } = await import('./puPrintRows.js')

const LINES = [
  { id: 11, 行号: '1', 物料编码: 'M-001', 物料名称: '物料A', 单位: '支', 数量: 10, 单价: 1.5, 金额: 15 },
  // 带折扣的行:金额(80) ≠ 单价×数量(100) —— 没改数量时必须原样落纸
  { id: 12, 行号: '2', 物料编码: 'M-002', 物料名称: '物料B', 单位: '支', 数量: 10, 单价: 10, 金额: 80 },
]

test('puOrderPrintRows:只落勾选的行,没勾的一行都不打印', () => {
  const rows = puOrderPrintRows(LINES, { 11: 10 })
  assert.equal(rows.length, 1, '只勾了第 1 行')
  assert.equal(rows[0]['物料编码'], 'M-001')
  assert.equal(rows[0]['数量'], 10, '未改数量 ⇒ 原数量')
  assert.equal(rows[0]['金额'], 15, '未改数量 ⇒ 原金额')
  // 空 picks = 一行都不打印(由弹窗提示"至少勾一行",不在纯函数里猜默认值)
  assert.deepEqual(puOrderPrintRows(LINES, {}), [])
  assert.deepEqual(puOrderPrintRows(LINES), [])
})

test('puOrderPrintRows:改数量 ⇒ 小计=单价×本次数量(4位),原明细不被修改', () => {
  const rows = puOrderPrintRows(LINES, { 12: 3 })
  assert.equal(rows.length, 1)
  assert.equal(rows[0]['数量'], 3)
  assert.equal(rows[0]['金额'], 30, '单价 10 × 数量 3 = 30')
  assert.equal(LINES[1]['数量'], 10, '原始明细行不得被改写(打印不写回订单)')
  assert.equal(LINES[1]['金额'], 80, '原始金额同样不动')
  // 小数按 4 位收口(decimal(18,4) 同口径)
  const r = puOrderPrintRows([{ id: 1, 物料编码: 'X', 数量: 1, 单价: 1.23456, 金额: 1.23456 }], { 1: 2.3456 })
  assert.equal(r[0]['金额'], 2.8958, '1.23456 × 2.3456 = 2.895783936 → 2.8958(4 位小数)')
})

test('puOrderPrintRows:数量与原来相同时不重算金额(折扣/分摊后的金额原样保留)', () => {
  const rows = puOrderPrintRows(LINES, { 12: 10 })
  assert.equal(rows[0]['金额'], 80, '没改数量 ⇒ 原金额 80,而不是 单价×数量=100')
  // 空值 = 没填数量 ⇒ 保持原数量/原金额(弹窗里清空输入框不会把数量打成 0)
  const blank = puOrderPrintRows(LINES, { 11: '' })
  assert.equal(blank[0]['数量'], 10)
  assert.equal(blank[0]['金额'], 15)
})

test('puOrderPrintRows:行键缺 id 时退回行号/下标,勾选键只认字符串', () => {
  const rows = [
    { 行号: '7', 物料编码: 'A', 数量: 2, 单价: 3, 金额: 6 },
    { 物料编码: 'B', 数量: 1, 单价: 4, 金额: 4 },
  ]
  const out = puOrderPrintRows(rows, { 7: 5 })
  assert.equal(out.length, 1)
  assert.equal(out[0]['物料编码'], 'A')
  assert.equal(out[0]['金额'], 15, '3 × 5 = 15')
  // 第二行没有 id/行号 ⇒ 默认键是指下标 '1'
  const byIndex = puOrderPrintRows(rows, { 1: 2 })
  assert.equal(byIndex.length, 1)
  assert.equal(byIndex[0]['物料编码'], 'B')
})

test('puOrderLineAmount:数量没改取原金额,改了取 单价×数量;缺单价退回原金额', () => {
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10, 金额: 80 }, 10), 80)
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10, 金额: 80 }, 5), 50)
  assert.equal(puOrderLineAmount({ 数量: 10, 金额: 80 }, 5), 80, '没有单价 ⇒ 无法重算,退回原金额')
  assert.equal(puOrderLineAmount({ 数量: 10, 单价: 10 }, 5), 50, '没有原金额但有单价 ⇒ 按 单价×数量 算出来')
})
