import test from 'node:test'
import assert from 'node:assert/strict'
import { stockHintText, STOCK_HINT_TEXT } from './stockHint.js'

/**
 * 库存口径提示(2026-11-10 用户口径「我们想要以金蝶的库存数量为准」,确认走严格 A 口径):
 *   · 只有「转ERP + 金蝶人工审核」之后,库存才真正改变;
 *   · MES 审核仍会当场记账,但那是临时值,下一轮同步(≤5 分钟)就抹平。
 * 所以审核/审批通过后必须补一句说明,否则业务会以为"审核完库存就减了"。
 */

test('待转ERP ⇒ 提示里必须同时出现「转ERP」「金蝶审核」「5 分钟」', () => {
  const text = stockHintText('待转ERP')
  assert.ok(text, '这枚码必须有文案(后端 ButtonService.result(def,no,status) 就是这么写的)')
  assert.ok(text.includes('转ERP'), '要告诉用户动作是转ERP')
  assert.ok(text.includes('金蝶审核'), '要告诉用户金蝶还得审核')
  assert.ok(text.includes('5 分钟'), '要给出同步延迟,否则"改完又回去"没法解释')
})

test('不推送金蝶(调拨/盘点) ⇒ 新文案不能沿用"转ERP"的说法,要直说本单不改变库存', () => {
  const text = stockHintText('不推送金蝶')
  assert.ok(text.includes('不改变库存'), '调拨/盘点审核后库存必然被抹平,必须说清')
  assert.ok(!text.includes('需「转ERP」'), '这两类根本没有转ERP 按钮,不能给用户指一条不存在的路')
})

test('未知码 / 空值 ⇒ 空串(调用方据此不弹提示,避免每张非库存单据都弹一句)', () => {
  assert.equal(stockHintText(''), '')
  assert.equal(stockHintText(undefined), '')
  assert.equal(stockHintText(null), '')
  assert.equal(stockHintText('草稿'), '')
})

test('码表只有这两枚 —— 与后端 result() 写入的值一一对应(多写少写都算漂移)', () => {
  assert.deepEqual(Object.keys(STOCK_HINT_TEXT).sort(), ['不推送金蝶', '待转ERP'])
})
