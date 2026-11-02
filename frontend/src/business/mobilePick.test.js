/**
 * mobilePick.test.js — 「手机扫码 · 生产领料」纯逻辑单测(2026-10-30)
 *
 * 钉住用户明确给过的四条口径:
 *   ① 组装BOM表的「用量」是 nvarchar,写成 `1`/`2.5`/`1/支` 都要能读出数字,读不出就 0(**不猜**);
 *   ② 领料数量上限 = **该物料库存总量(跨批次合计)**,超出**自动拆到下一批**;
 *   ③ 「全部领料完成」= **每行都有领料数量(>0)**,不要求等于 BOM 用量;
 *   ④ 退料默认 0 属正常 —— 不做退料不影响提交,也不会被当成"没领完"。
 *
 * 运行:`cd frontend && npm test`(node --test,与其它 business/*.test.js 同一套)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseUsage, toRows, maxQtyOf, allocateForQty, allocateScannedFirst,
  pickProgress, backIsEmpty, round4,
} from './mobilePick.js'

// ─── ① BOM 用量解析 ───────────────────────────────────────────────

test('parseUsage:纯数字 / 小数 / 带单位 都取第一个数字', () => {
  assert.equal(parseUsage('1'), 1)
  assert.equal(parseUsage('2.5'), 2.5)
  assert.equal(parseUsage('1/支'), 1)
  assert.equal(parseUsage('0.5 kg'), 0.5)
  assert.equal(parseUsage(' 12 PCS '), 12)
})

test('parseUsage:取不到数字返回 0,**不猜**', () => {
  assert.equal(parseUsage(''), 0)
  assert.equal(parseUsage(null), 0)
  assert.equal(parseUsage('适量'), 0)
  assert.equal(parseUsage('—'), 0)
})

test('parseUsage:按 4 位小数取整(与 decimal(18,4) 同口径)', () => {
  assert.equal(parseUsage('1.23456789'), 1.2346)
})

// ─── 行模型 ──────────────────────────────────────────────────────

const samplePick = [
  { 行号: '1', 编码: 'YJ-ZZ-001', 名称: '热缩膜', 单位: '米', 数量: 47.4, 仓库: '恒亿仓' },
  { 行号: '2', 编码: 'YJ-KBL-012', 名称: 'PE袋', 单位: '个', 数量: 0, 仓库: '恒亿仓' },
]

test('toRows:领料侧「有数量」即标记已扫', () => {
  const rows = toRows(samplePick, 'pick')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].已扫, true)
  assert.equal(rows[1].已扫, false)
  assert.equal(rows[0].编码, 'YJ-ZZ-001')
})

test('toRows:数量为 0 的行仍未扫(退料侧同理,但 0 是常态)', () => {
  const back = toRows([{ 行号: '1', 编码: 'A', 数量: 0 }], 'back')
  assert.equal(back[0].数量, 0)
  assert.equal(back[0].已扫, false)
})

// ─── ② 数量上限 = 跨批次合计 ─────────────────────────────────────

const batchRows = [
  { lot: '20260917', warehouse: '恒亿仓', avail: 3, qty: 0, checked: false, scanned: false },
  { lot: '20260925', warehouse: '恒亿仓', avail: 5, qty: 0, checked: false, scanned: false },
]

test('maxQtyOf:领料上限 = 各批次可用量合计(跨批次,不看单批)', () => {
  assert.equal(maxQtyOf(batchRows, 'pick'), 8)
})

test('maxQtyOf:退料上限 = 该物料已领数量', () => {
  assert.equal(maxQtyOf(batchRows, 'back', 10), 10)
  assert.equal(maxQtyOf(batchRows, 'back', 0), 0)
})

test('allocateForQty:数量超过第一批 ⇒ 自动拆到下一批(不报错)', () => {
  const r = allocateForQty(batchRows, 6)
  assert.equal(r.allocated, 6)
  assert.equal(r.shortage, 0)
  assert.equal(r.rows[0].qty, 3) // 第一批填满
  assert.equal(r.rows[1].qty, 3) // 剩下 3 落到第二批
})

test('allocateForQty:数量正好吃满所有批次', () => {
  const r = allocateForQty(batchRows, 8)
  assert.equal(r.allocated, 8)
  assert.equal(r.shortage, 0)
})

test('allocateForQty:超过总库存会留下 shortage(前端据此拦) ', () => {
  const r = allocateForQty(batchRows, 10)
  assert.equal(r.allocated, 8)
  assert.equal(r.shortage, 2)
})

test('allocateForQty:0 / 负数 ⇒ 不分配', () => {
  assert.equal(allocateForQty(batchRows, 0).allocated, 0)
  assert.equal(allocateForQty(batchRows, -5).allocated, 0)
})

// ─── 扫描先填那一批(批次沿用旧逻辑) ──────────────────────────────

const scannedRows = [
  { lot: 'A-early', warehouse: 'W', avail: 2, qty: 0, checked: false, scanned: false },
  { lot: 'B-scanned', warehouse: 'W', avail: 4, qty: 0, checked: false, scanned: true },
  { lot: 'C-late', warehouse: 'W', avail: 9, qty: 0, checked: false, scanned: false },
]

test('allocateScannedFirst:扫到的那一批先填满,不够再往后面补', () => {
  const r = allocateScannedFirst(scannedRows, 5)
  assert.equal(r.allocated, 5)
  // 先填扫到的 B(4),还剩 1 ⇒ 按 FIFO 往 A 补(1)
  assert.equal(r.rows[1].qty, 4)
  assert.equal(r.rows[0].qty, 1)
  assert.equal(r.rows[2].qty, 0)
})

test('allocateScannedFirst:没扫到批次 ⇒ 纯先进先出', () => {
  const rows = scannedRows.map((b) => ({ ...b, scanned: false }))
  const r = allocateScannedFirst(rows, 3)
  assert.equal(r.rows[0].qty, 2) // A-early 先出
  assert.equal(r.rows[1].qty, 1)
})

test('allocateScannedFirst:数量 0 ⇒ 全部清零', () => {
  const r = allocateScannedFirst(scannedRows, 0)
  assert.equal(r.allocated, 0)
  assert.ok(r.rows.every((b) => b.qty === 0))
})

// ─── ③ 全部领完判定 ──────────────────────────────────────────────

test('pickProgress:每行都有数量才算完成', () => {
  const p = pickProgress(toRows([
    { 编码: 'A', 数量: 5 },
    { 编码: 'B', 数量: 2 },
  ], 'pick'))
  assert.equal(p.ok, true)
  assert.equal(p.total, 2)
  assert.equal(p.done, 2)
})

test('pickProgress:有一行数量为 0 ⇒ 不能提交,并点名缺哪几项', () => {
  const p = pickProgress(toRows([
    { 编码: 'A', 数量: 5 },
    { 编码: 'B', 数量: 0 },
    { 编码: 'C', 数量: 0 },
  ], 'pick'))
  assert.equal(p.ok, false)
  assert.equal(p.done, 1)
  assert.deepEqual(p.missing, ['B', 'C'])
})

test('pickProgress:不是"等于 BOM 用量"才算完成 —— 多领少领都算', () => {
  const p = pickProgress(toRows([
    { 编码: 'A', 数量: 1, BOM用量: 10 },   // 少领
    { 编码: 'B', 数量: 99, BOM用量: 2 },   // 多领
  ], 'pick'))
  assert.equal(p.ok, true)
})

test('pickProgress:空明细不能提交', () => {
  const p = pickProgress([])
  assert.equal(p.ok, false)
  assert.equal(p.total, 0)
})

// ─── ④ 退料默认 0 ────────────────────────────────────────────────

test('backIsEmpty:退料全 0 ⇒ true(提交时这张退料单会被作废)', () => {
  assert.equal(backIsEmpty(toRows([
    { 编码: 'A', 数量: 0 },
    { 编码: 'B', 数量: 0 },
  ], 'back')), true)
})

test('backIsEmpty:有一条填了数量 ⇒ false(要真退料)', () => {
  assert.equal(backIsEmpty(toRows([
    { 编码: 'A', 数量: 0 },
    { 编码: 'B', 数量: 3 },
  ], 'back')), false)
})

test('退料默认 0 不影响领料判定(两者互不牵连)', () => {
  const pick = pickProgress(toRows([{ 编码: 'A', 数量: 5 }], 'pick'))
  const back = backIsEmpty(toRows([{ 编码: 'A', 数量: 0 }], 'back'))
  assert.equal(pick.ok, true)
  assert.equal(back, true)
})

// ─── 数值精度 ───────────────────────────────────────────────────

test('round4:0.1 + 0.2 的浮点尾巴不误判', () => {
  assert.equal(round4(0.1 + 0.2), 0.3)
})
