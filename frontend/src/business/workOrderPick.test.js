/**
 * workOrderPick.test.js — 工单扫码领料纯逻辑单测(2026-10-21)
 *
 * 每条断言都指向具体生产逻辑,改坏必红:
 *   · parseWorkOrderQr   → 工单码 `公司代码@工单号@(1000+行号)` 的解析与减 1000
 *   · expandBom          → 应领 = 标准用量 × 排产数量 + 损耗量
 *   · applyScan          → **只按编码匹配**(批号不参与过滤)、累加与 remain 计算
 *   · checkScaleReading  → 脏值(-1)/过期/跳动 的拦截
 *   · buildPickForm      → MATERIAL_OUT 字段名与必填项
 *   · pickProgress       → 整单提交判据
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWorkOrderQr,
  expandBom,
  applyScan,
  checkScaleReading,
  buildPickForm,
  pickProgress,
} from './workOrderPick.js'

test('parseWorkOrderQr:标准工单码 → 行号减 1000', () => {
  const r = parseWorkOrderQr('YJ@GD-2026-10-0220@1002')
  assert.equal(r.ok, true)
  assert.equal(r.company, 'YJ')
  assert.equal(r.orderNo, 'GD-2026-10-0220')
  assert.equal(r.lineNo, 2)
})

test('parseWorkOrderQr:行号 1001 → 1,1000 → 0', () => {
  assert.equal(parseWorkOrderQr('YJ@GD-1@1001').lineNo, 1)
  assert.equal(parseWorkOrderQr('YJ@GD-1@1000').lineNo, 0)
})

test('parseWorkOrderQr:没有行号段 → lineNo=0(整单)', () => {
  const r = parseWorkOrderQr('YJ@GD-2026-10-0220')
  assert.equal(r.ok, true)
  assert.equal(r.orderNo, 'GD-2026-10-0220')
  assert.equal(r.lineNo, 0)
})

test('parseWorkOrderQr:不带 1000 前缀的裸行号也认', () => {
  assert.equal(parseWorkOrderQr('YJ@GD-1@3').lineNo, 3)
})

test('parseWorkOrderQr:空串/无工单号/行号非数字 → 拒绝', () => {
  assert.equal(parseWorkOrderQr('').reason, 'empty')
  assert.equal(parseWorkOrderQr('   ').reason, 'empty')
  assert.equal(parseWorkOrderQr('YJ').reason, 'no-order')
  assert.equal(parseWorkOrderQr('YJ@').reason, 'no-order')
  assert.equal(parseWorkOrderQr('YJ@GD-1@abc').reason, 'bad-line')
})

test('parseWorkOrderQr:扫到物料码(含 |)不该被当工单码', () => {
  // 物料码 YJ-SX-001|20261014001 没有 @ → 判为 no-order
  const r = parseWorkOrderQr('YJ-SX-001|20261014001')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'no-order')
})

test('expandBom:应领 = 标准用量 × 排产数量 + 损耗量', () => {
  const bom = [
    { 子件代码: 'M-001', 子件名称: '炭棒', 子件单位: '支', 标准用量: 2, 损耗量: 1 },
    { 子件代码: 'M-003', 子件名称: '炭纤维', 子件单位: '支', 标准用量: 0.5, 损耗量: 0 },
  ]
  const lines = expandBom(bom, 10)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].required, 21)   // 2*10 + 1
  assert.equal(lines[1].required, 5)    // 0.5*10
  assert.equal(lines[0].picked, 0)
  assert.equal(lines[0].remain, 21)
})

test('expandBom:排产数量 0 → 应领只剩损耗量', () => {
  const lines = expandBom([{ 子件代码: 'M-1', 标准用量: 3, 损耗量: 2 }], 0)
  assert.equal(lines[0].required, 2)
})

test('expandBom:没有子件代码的行被跳过;小数按 4 位收敛', () => {
  const lines = expandBom([
    { 子件代码: '', 标准用量: 1 },
    { 子件代码: 'M-1', 标准用量: 0.1, 损耗量: 0 },
  ], 3)
  assert.equal(lines.length, 1)
  assert.equal(lines[0].required, 0.3)  // 0.1*3 无浮点尾差
})

test('applyScan:只按编码匹配 —— 批号不参与过滤', () => {
  const lines = expandBom([{ 子件代码: 'M-001', 标准用量: 1 }], 5)
  // 码里批号与库里完全无关,仍应命中
  const r = applyScan(lines, { code: 'M-001', batch: '20261014001' }, 2)
  assert.equal(r.ok, true)
  assert.equal(r.index, 0)
  assert.equal(lines[0].picked, 2)
  assert.equal(lines[0].remain, 3)
})

test('applyScan:多次扫码累加', () => {
  const lines = expandBom([{ 子件代码: 'M-001', 标准用量: 1 }], 10)
  applyScan(lines, { code: 'M-001', batch: '' }, 3)
  applyScan(lines, { code: 'M-001', batch: '' }, 4)
  assert.equal(lines[0].picked, 7)
  assert.equal(lines[0].remain, 3)
})

test('applyScan:编码不在 BOM 里 → miss,不改动任何行', () => {
  const lines = expandBom([{ 子件代码: 'M-001', 标准用量: 1 }], 5)
  const r = applyScan(lines, { code: 'X-999', batch: '' }, 2)
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'miss')
  assert.equal(lines[0].picked, 0)
})

test('applyScan:数量 <=0 或非数字 → no-qty', () => {
  const lines = expandBom([{ 子件代码: 'M-001', 标准用量: 1 }], 5)
  assert.equal(applyScan(lines, { code: 'M-001' }, 0).reason, 'no-qty')
  assert.equal(applyScan(lines, { code: 'M-001' }, -1).reason, 'no-qty')
  assert.equal(applyScan(lines, { code: 'M-001' }, 'abc').reason, 'no-qty')
})

test('applyScan:超领不拦死,但 remain 为负且标 exceed', () => {
  const lines = expandBom([{ 子件代码: 'M-001', 标准用量: 1 }], 5)
  const r = applyScan(lines, { code: 'M-001' }, 8)
  assert.equal(r.ok, true)
  assert.equal(r.exceed, true)
  assert.equal(lines[0].remain, -3)
})

test('checkScaleReading:正常稳定读数通过', () => {
  const now = 1000000
  const r = checkScaleReading({ value: 9.44, at: new Date(now - 1000) }, null, { now })
  assert.equal(r.ok, false)   // 无 stable 标志且无上一次 → 不稳定
  const r2 = checkScaleReading({ value: 9.44, at: new Date(now - 1000), stable: true }, null, { now })
  assert.equal(r2.ok, true)
  assert.equal(r2.value, 9.44)
})

test('checkScaleReading:连续两次一致才认稳定', () => {
  const now = 1000000
  const prev = { value: 9.44, at: new Date(now - 2000) }
  const r = checkScaleReading({ value: 9.44, at: new Date(now - 1000) }, prev, { now })
  assert.equal(r.ok, true)
  // 跳动的值不认
  const r2 = checkScaleReading({ value: 9.51, at: new Date(now - 1000) }, prev, { now })
  assert.equal(r2.ok, false)
  assert.equal(r2.reason, 'unstable')
})

test('checkScaleReading:库里出现过的 -1 脏值必须拦下', () => {
  const now = 1000000
  const r = checkScaleReading({ value: -1, at: new Date(now - 500), stable: true }, null, { now })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'negative')
})

test('checkScaleReading:0 也拦下(空秤)', () => {
  const now = 1000000
  assert.equal(checkScaleReading({ value: 0, at: new Date(now - 500) }, null, { now }).reason, 'negative')
})

test('checkScaleReading:过期读数(超窗口)→ stale', () => {
  const now = 1000000
  const r = checkScaleReading({ value: 9.44, at: new Date(now - 30000), stable: true }, null, { now, windowMs: 10000 })
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'stale')
})

test('checkScaleReading:非数字/无时间 → 拒绝', () => {
  const now = 1000000
  assert.equal(checkScaleReading({ value: 'x', at: new Date(now) }, null, { now }).reason, 'no-value')
  assert.equal(checkScaleReading({ value: 5 }, null, { now }).reason, 'stale')
})

test('buildPickForm:表头/明细字段名与 MATERIAL_OUT 一致', () => {
  const lines = expandBom([
    { 子件代码: 'M-001', 子件名称: '炭棒', 子件单位: '支', 标准用量: 2 },
  ], 5)
  applyScan(lines, { code: 'M-001' }, 10)
  const f = buildPickForm({ orderNo: 'GD-2026-10-0220', lineNo: 2, warehouse: 'CK00001', lines })
  assert.equal(f.业务类型, '生产领料')
  assert.equal(f.单据编号, '')                    // 后端生成
  assert.equal(f.加工单号, 'GD-2026-10-0220')     // 回写 plang.ll_no2 用
  assert.equal(f.工单行号, '2')
  assert.equal(f.detail.items.length, 1)
  const it = f.detail.items[0]
  assert.equal(it.材料编码, 'M-001')
  assert.equal(it.材料名称, '炭棒')
  assert.equal(it.计量单位, '支')
  assert.equal(it.数量, 10)
  assert.equal(it.仓库, 'CK00001')
  assert.equal(it.行号, '1')
})

test('buildPickForm:未领(picked=0)的行不进单据', () => {
  const lines = expandBom([
    { 子件代码: 'M-001', 标准用量: 1 },
    { 子件代码: 'M-002', 标准用量: 1 },
  ], 5)
  applyScan(lines, { code: 'M-001' }, 3)
  const f = buildPickForm({ orderNo: 'GD-1', lineNo: 1, lines })
  assert.equal(f.detail.items.length, 1)
  assert.equal(f.detail.items[0].材料编码, 'M-001')
})

test('pickProgress:每行都领过才 allPicked', () => {
  const lines = expandBom([
    { 子件代码: 'M-001', 标准用量: 1 },
    { 子件代码: 'M-002', 标准用量: 1 },
  ], 5)
  assert.deepEqual(pickProgress(lines), { total: 2, done: 0, allPicked: false, anyPicked: false })
  applyScan(lines, { code: 'M-001' }, 1)
  assert.deepEqual(pickProgress(lines), { total: 2, done: 1, allPicked: false, anyPicked: true })
  applyScan(lines, { code: 'M-002' }, 1)
  assert.deepEqual(pickProgress(lines), { total: 2, done: 2, allPicked: true, anyPicked: true })
})

test('pickProgress:空清单不算 allPicked', () => {
  assert.equal(pickProgress([]).allPicked, false)
  assert.equal(pickProgress(null).allPicked, false)
})
