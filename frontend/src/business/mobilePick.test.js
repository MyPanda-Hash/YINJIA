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
  pickProgress, backIsEmpty, round4, printJobsOf, locateQueryOf,
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

/**
 * 半成品(编码含 **TB)只显示、不领料、可跳过(2026-11-16 用户口径:
 * 「生产领料单有一行带TB的是半成品…只要显示这行数据,但是实际并不领料就可以,
 * 不要影响别的物料正常领料,半成品是可跳过的」)。
 */
test('pickProgress:半成品不算进分母 —— 别把它当成"还没领的那一项"', () => {
  const p = pickProgress(toRows([
    { 编码: 'A-1', 数量: 5 },                    // 正常物料,已领
    { 编码: 'T410**TB', 数量: 0, 半成品: true },  // 半成品:数量永远是 0
  ], 'pick'))
  assert.equal(p.total, 1, '分母只算能领的')
  assert.equal(p.done, 1)
  assert.equal(p.ok, true, '半成品没领也不该挡住提交')
  assert.deepEqual(p.missing, [], '半成品不能被点名成"缺料"')
})

test('pickProgress:只有半成品时不能提交(等于没有可领的料)', () => {
  const p = pickProgress(toRows([{ 编码: 'T410**TB', 数量: 0, 半成品: true }], 'pick'))
  assert.equal(p.total, 0)
  assert.equal(p.ok, false)
})

test('pickProgress:半成品不影响别的物料缺料判定', () => {
  const p = pickProgress(toRows([
    { 编码: 'T410**TB', 数量: 0, 半成品: true },
    { 编码: 'A-1', 数量: 0 },   // 真的没领
  ], 'pick'))
  assert.equal(p.total, 1)
  assert.equal(p.ok, false)
  assert.deepEqual(p.missing, ['A-1'], '只点名真正要领而没领的那项')
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
// ─── 生单后的「打几张纸」 ─────────────────────────────────────────

test('printJobsOf:一个工单行出两张单(组装+混料)⇒ 两张都要打', () => {
  // 2026-11-18 用户报障「只打组装领料,混料领料没打印」—— 顶层 打印 只是组装那张,
  // 真正的清单在 单据[i].打印 里,必须逐张取。
  const result = {
    打印: { 领料单号: 'LL-1', 标题: '生产领料单', 二维码内容: '0@GD-1@1001' },
    单据: [
      { 领料单号: 'LL-1', 领料类型: '组装', 打印: { 领料单号: 'LL-1', 标题: '生产领料单' } },
      { 领料单号: 'LL-2', 领料类型: '混料', 打印: { 领料单号: 'LL-2', 标题: '混料领料单' } },
    ],
  }
  const jobs = printJobsOf(result)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((j) => j.领料单号), ['LL-1', 'LL-2'])
  assert.equal(jobs[1].标题, '混料领料单')
})

test('printJobsOf:没有 单据 数组时退回顶层 打印(老结构 / 只有一张单)', () => {
  const jobs = printJobsOf({ 打印: { 领料单号: 'LL-9', 标题: '生产领料单' } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].领料单号, 'LL-9')
})

test('printJobsOf:重复扫码把同一张单列两遍 ⇒ 只打一次', () => {
  const one = { 领料单号: 'LL-7', 标题: '生产领料单' }
  const jobs = printJobsOf({ 单据: [{ 打印: one }, { 打印: { ...one } }] })
  assert.equal(jobs.length, 1)
})

test('printJobsOf:打印载荷为空(关掉自动打印)⇒ 一张都不打', () => {
  assert.deepEqual(printJobsOf({ 打印: null, 单据: [{ 打印: null }, { 打印: null }] }), [])
  assert.deepEqual(printJobsOf(null), [])
})
// ─── 生产领料扫码定位(领料标记) ─────────────────────────────────

test('locateQueryOf:领料单纸面码 @M/@A → 带出工单行号与领料类型', () => {
  // 2026-11-18 用户报障「扫混料和扫组装的二维码,都跳到组装的单据界面」——
  // 前端必须把第 4 段的标记一起传给后端,否则后端只能按第一张(组装)打开。
  assert.deepEqual(locateQueryOf('0@GD-2026-11-0007@1004@M'),
    { wo: 'GD-2026-11-0007', line: 4, kind: '混料' })
  assert.deepEqual(locateQueryOf('0@GD-2026-11-0007@1004@A'),
    { wo: 'GD-2026-11-0007', line: 4, kind: '组装' })
})

test('locateQueryOf:老的三段工单码 → kind 为空(行为照旧)', () => {
  assert.deepEqual(locateQueryOf('0@GD-2026-11-0007@1004'),
    { wo: 'GD-2026-11-0007', line: 4, kind: '' })
})

test('locateQueryOf:纯工单号 / 领料单号 / 空串', () => {
  assert.deepEqual(locateQueryOf('GD-2026-11-0007'), { wo: 'GD-2026-11-0007', line: 0, kind: '' })
  assert.deepEqual(locateQueryOf('LL-2026-11-0044'), { wo: 'LL-2026-11-0044', line: 0, kind: '' })
  assert.deepEqual(locateQueryOf('   '), { wo: '', line: 0, kind: '' })
})