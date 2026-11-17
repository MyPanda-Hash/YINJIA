/**
 * mixScan.test.js — 扫码混料纯逻辑单测(2026-11-18)
 *
 * 每条断言都指向具体生产逻辑,改坏必红:
 *   · parseWorkOrderQr   → 工单码 `公司代码@工单号@(1000+行号)` 的解析与减 1000
 *   · expandBom          → 应投量 = 标准用量 × 排产数量 + 损耗量
 *   · applyScan          → **只按编码匹配**(批号不参与过滤)、累加与 remain 计算
 *   · checkScaleReading  → 脏值(-1)/过期/跳动 的拦截
 *   · scaleReadingOf     → /dc/monitor 扁平 points 的形状归一(重量点位 / 状态 / 设备码)
 *   · mixProgress        → 「全部扫完才能整单保存」的判据
 *   · buildScanPayload   → POST /px/mix/scan 的字段名(与后端正文字段逐一对应)
 *   · buildMixSlipPayload→ 混料单纸面载荷(表头/部门标签/签名 + 计划→请领、实际→实发)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseWorkOrderQr,
  expandBom,
  applyScan,
  checkScaleReading,
  scaleReadingOf,
  mixProgress,
  buildScanPayload,
  buildMixSlipPayload,
  MIX_PAPER,
} from './mixScan.js'

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

test('expandBom:应投 = 标准用量 × 排产数量 + 损耗量', () => {
  const bom = [
    { 子件代码: 'YJ-TJHZ-001', 子件名称: '雅可比CS', 子件单位: 'kg', 标准用量: 0.086, 损耗量: 0 },
    { 子件代码: 'YJ-YKRS-005', 子件名称: '活性炭', 子件单位: 'kg', 标准用量: 0.021, 损耗量: 0.5 },
  ]
  const lines = expandBom(bom, 1000)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].required, 86)     // 0.086*1000
  assert.equal(lines[1].required, 21.5)   // 0.021*1000 + 0.5
  assert.equal(lines[0].picked, 0)
  assert.equal(lines[0].remain, 86)
})

test('expandBom:排产数量 0 → 应投只剩损耗量', () => {
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

test('applyScan:编码不在物料清单里 → miss,不改动任何行', () => {
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

test('applyScan:超投不拦死,但 remain 为负且标 exceed', () => {
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

test('scaleReadingOf:扁平 points 里取「重量」点位(2026-10-21 的踩坑结构)', () => {
  const r = scaleReadingOf({ data: { deviceCode: 'DZ-001', points: [
    { name: '温度', valueNum: 25, unit: 'C', at: '2026-11-18T09:00:00', status: 'normal' },
    { name: '重量(kg)', valueNum: 0.39, unit: 'kg', at: '2026-11-18T09:00:01', status: 'normal' },
  ] } })
  assert.equal(r.value, 0.39)
  assert.equal(r.stable, true)
  assert.equal(r.deviceCode, 'DZ-001')
})

test('scaleReadingOf:没有点位/没有重量列 → null(页面显示「等待称重」)', () => {
  assert.equal(scaleReadingOf({ data: {} }), null)
  assert.equal(scaleReadingOf(null), null)
})

test('scaleReadingOf:非 normal 状态不算稳定(报警/超限不取值)', () => {
  const r = scaleReadingOf({ points: [{ name: '重量', valueNum: 2, unit: 'kg', status: 'alarm' }] })
  assert.equal(r.value, 2)
  assert.equal(r.stable, false)
})

test('mixProgress:每行都记过才能整单保存', () => {
  const lines = expandBom([
    { 子件代码: 'M-001', 标准用量: 1 },
    { 子件代码: 'M-002', 标准用量: 1 },
  ], 5)
  assert.deepEqual(mixProgress(lines),
    { total: 2, done: 0, allDone: false, anyDone: false, remainCount: 2 })
  applyScan(lines, { code: 'M-001' }, 1)
  assert.deepEqual(mixProgress(lines),
    { total: 2, done: 1, allDone: false, anyDone: true, remainCount: 1 })
  applyScan(lines, { code: 'M-002' }, 1)
  assert.deepEqual(mixProgress(lines),
    { total: 2, done: 2, allDone: true, anyDone: true, remainCount: 0 })
})

test('mixProgress:空清单不算 allDone', () => {
  assert.equal(mixProgress([]).allDone, false)
  assert.equal(mixProgress(null).allDone, false)
})

test('buildScanPayload:字段名与后端 /px/mix/scan 一致,含 计划用量 与 实际用量', () => {
  const order = { orderNo: 'GD-2026-10-0089', lineNo: 3, lineId: 88, productCode: 'A-32-01', productName: '炭棒' }
  const line = { code: 'YJ-TJHZ-001', name: '雅可比CS', uom: 'kg', required: 226.18 }
  const body = buildScanPayload({ order, line, qty: 226.1849, batch: '20261118001' })
  assert.equal(body.工单号, 'GD-2026-10-0089')
  assert.equal(body.工单行号, 3)
  assert.equal(body.工单行id, 88)
  assert.equal(body.产品编码, 'A-32-01')
  assert.equal(body.物料编号, 'YJ-TJHZ-001')
  assert.equal(body.物料名称, '雅可比CS')
  assert.equal(body.计划用量, 226.18)
  assert.equal(body.实际用量, 226.1849)   // 4 位收敛
  assert.equal(body.物料批次, '20261118001')  // 物料码里的批号要落库(纸面「物料批次」列)
  assert.equal(body.单位, 'kg')
})

test('buildScanPayload:没有行 id 时不下发该字段(后端 longOrNull 会兜底)', () => {
  const body = buildScanPayload({
    order: { orderNo: 'GD-1', lineNo: 1, lineId: 0 },
    line: { code: 'M-1', required: 1 },
    qty: 1,
  })
  assert.equal(body.工单行id, undefined)
  assert.equal(body.物料批次, '')   // 取秤提交(没扫到码)时批次为空,不是 undefined
})

test('buildMixSlipPayload:专用纸表 = 《成型配料记录》横板 A4 的抬头 + 物料行', () => {
  const payload = buildMixSlipPayload({
    docNo: 'PL2611180001',
    data: {
      标题: '成型配料记录',
      文件编码: 'YJ-QR-147',
      单据编号: 'PL2611180001',
      车间: '成型1线',
      产品编号: 'A-45-01',
      配方版本号: '',
      开始时间: '2026-11-18 09:01:02',
      结束时间: '2026-11-18 09:20:00',
      配料批次号: 'PL2611180001',
      配料人: 'admin',
      单据日期: '2026-11-18 09:01:02',
      明细: [{ 物料编号: 'YJ-TJHZ-001', 物料名: '雅可比CS', 添加比例: '18.67%', 应投重量: '86.172', 实投重量: '86.172', 物料批次: '20261118001' }],
    },
  })
  assert.equal(payload.标题, '成型配料记录')
  assert.equal(payload.领料单号, 'PL2611180001')      // 任务单号(打印缓存/站点列表认单)
  assert.equal(payload.打印日期, '2026-11-18')
  assert.equal(payload.纸面.车间, '成型1线')
  assert.equal(payload.纸面.产品编号, 'A-45-01')
  assert.equal(payload.纸面.配料批次号, 'PL2611180001')
  assert.equal(payload.纸面.文件编码, 'YJ-QR-147')
  assert.equal(payload.纸面.序号, 1)
  assert.equal(payload.明细.length, 1)
  assert.equal(payload.明细[0].物料批次, '20261118001')
})

test('buildMixSlipPayload:后端缺字段时给空串/默认抬头(纸表照样画格子)', () => {
  const payload = buildMixSlipPayload({ docNo: 'PL1', data: {} })
  assert.equal(payload.纸面.标题, '成型配料记录')
  assert.equal(payload.纸面.文件编码, 'YJ-QR-147')
  assert.equal(payload.纸面.配料批次号, 'PL1')     // 没有配料批次号就用单号兜
  assert.equal(payload.纸面.车间, '')
  assert.deepEqual(payload.明细, [])
  assert.equal(payload.打印日期, '')
})

test('MIX_PAPER:纸样口径固定(标题/文件编码/横板 A4)', () => {
  assert.equal(MIX_PAPER.标题, '成型配料记录')
  assert.equal(MIX_PAPER.文件编码, 'YJ-QR-147')
  assert.equal(MIX_PAPER.纸张.w, '297mm')
  assert.equal(MIX_PAPER.纸张.h, '210mm')
})
