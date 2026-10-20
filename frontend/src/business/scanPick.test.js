import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBarcode, matchPickRows, checkPickQty, buildMaterialOutForm, batchDate, fifoSort, sumAvailable, allocateFifo } from './scanPick.js'

/**
 * scanPick.test.js — 条码扫码领料的纯逻辑(2026-10-18)
 *
 * 钉住三件现场一定会踩的事:① 码内容 `编码|批号` 的异常形态要被拦;
 * ② 匹配必须全等(编码有 M-001 / XM-001 这种前缀包含);③ 领用数量不能超批号级现存量。
 */

test('码内容:正常两段', () => {
  assert.deepEqual(parseBarcode('C5191H-0D20|20260826'), { ok: true, code: 'C5191H-0D20', batch: '20260826' })
})

test('码内容:只有编码(不分批物料)也算合法', () => {
  assert.deepEqual(parseBarcode('M-001'), { ok: true, code: 'M-001', batch: '' })
})

test('码内容:空串/空格 → empty', () => {
  assert.equal(parseBarcode('').reason, 'empty')
  assert.equal(parseBarcode('   ').reason, 'empty')
  assert.equal(parseBarcode(null).reason, 'empty')
})

test('码内容:以 | 开头(没有编码) → no-code', () => {
  assert.equal(parseBarcode('|20260826').reason, 'no-code')
})

test('码内容:三段及以上 → too-many(扫错码)', () => {
  assert.equal(parseBarcode('A|B|C').reason, 'too-many')
})

test('码内容:首尾空格被 trim', () => {
  assert.deepEqual(parseBarcode('  A-1 | B-2  '), { ok: true, code: 'A-1', batch: 'B-2' })
})

const pickRows = [
  { 存货编码: 'M-001', 批号: 'P1', 仓库: '原料仓', 现存量: 100 },
  { 存货编码: 'M-001', 批号: 'P2', 仓库: '原料仓', 现存量: 50 },
  { 存货编码: 'XM-001', 批号: 'P1', 仓库: '原料仓', 现存量: 999 },
  { 存货编码: 'M-001', 批号: '', 仓库: '原料仓', 现存量: 7 },
]

test('匹配:按存货编码全等(不能命中 XM-001 这种前缀包含)', () => {
  const hit = matchPickRows(pickRows, { code: 'M-001', batch: 'P1' })
  // M-001 有三行(P1/P2/空批号),XM-001 不能混进来
  assert.equal(hit.length, 3)
  assert.ok(hit.every((r) => r.存货编码 === 'M-001'))
})

test('匹配:同批号的排在最前(批号不参与过滤,只用于优先)', () => {
  const hit = matchPickRows(pickRows, { code: 'M-001', batch: 'P2' })
  assert.equal(hit[0].批号, 'P2')
  assert.equal(hit.length, 3)
})

test('匹配:码里的批号在库存里不存在时,仍按编码返回全部(实测 849/849 走这条)', () => {
  // 条码派生批号(20261014001)与 kucun 实际批号(SX-…)对不上 → 不能返回空
  const rows = [
    { 存货编码: 'A', 批号: 'SX-20261007', 仓库: 'W1', 现存量: 3 },
    { 存货编码: 'A', 批号: '', 仓库: 'W2', 现存量: 4 },
  ]
  const hit = matchPickRows(rows, { code: 'A', batch: '20261014001' })
  assert.equal(hit.length, 2)
  assert.equal(hit.reduce((s, r) => s + Number(r.现存量), 0), 7)
})

test('匹配:同一(编码,批号)在多仓库时全返回', () => {
  const rows = [
    { 存货编码: 'A', 批号: 'B', 仓库: 'W1', 现存量: 3 },
    { 存货编码: 'A', 批号: 'B', 仓库: 'W2', 现存量: 4 },
  ]
  assert.equal(matchPickRows(rows, { code: 'A', batch: 'B' }).length, 2)
})

test('匹配:没有编码时返回空', () => {
  assert.deepEqual(matchPickRows(pickRows, { code: '', batch: 'P1' }), [])
})

test('数量:正常/等于现存量(含小数)', () => {
  assert.equal(checkPickQty({ qty: 10, available: 100 }).ok, true)
  assert.equal(checkPickQty({ qty: 100, available: 100 }).ok, true)
  assert.equal(checkPickQty({ qty: 0.3, available: 0.3 }).ok, true)
})

test('数量:超出现存量 → exceed', () => {
  assert.deepEqual(checkPickQty({ qty: 101, available: 100 }), { ok: false, reason: 'exceed' })
  assert.deepEqual(checkPickQty({ qty: 0.31, available: 0.3 }), { ok: false, reason: 'exceed' })
})

test('数量:非正数 → no-qty', () => {
  assert.equal(checkPickQty({ qty: 0, available: 100 }).reason, 'no-qty')
  assert.equal(checkPickQty({ qty: -1, available: 100 }).reason, 'no-qty')
  assert.equal(checkPickQty({ qty: NaN, available: 100 }).reason, 'no-qty')
})

test('数量:该批号没有库存 → no-stock(即使数量填了)', () => {
  assert.equal(checkPickQty({ qty: 1, available: 0 }).reason, 'no-stock')
})

test('建单:明细必填列齐 + 金额按数量×单价', () => {
  const form = buildMaterialOutForm(
    [{ code: 'M-001', name: '端盖', uom: '个', batch: 'P1', warehouse: '原料仓', qty: 2, price: 1.5 }],
    { date: '2026-10-18' },
  )
  assert.equal(form.单据日期, '2026-10-18')
  assert.equal(form.业务类型, '生产领料')
  assert.equal(form.单据编号, '')
  const item = form.detail.items[0]
  assert.equal(item.材料编码, 'M-001')
  assert.equal(item.材料名称, '端盖')
  assert.equal(item.计量单位, '个')
  assert.equal(item.数量, 2)
  assert.equal(item.金额, 3)
  assert.equal(item.行号, '1')
})

/* ─────────── 批号日期 / 先进先出(2026-10-20 用户口径)─────────── */

test('批号日期:8 位数字/带分隔符都能取,取不到给空串', () => {
  assert.equal(batchDate('SX-20260907'), '2026-09-07')
  assert.equal(batchDate('20261014001'), '2026-10-14')
  assert.equal(batchDate('GL-2026-09-17'), '2026-09-17')
  assert.equal(batchDate('TL00210'), '')
  assert.equal(batchDate('PC0000'), '')
  assert.equal(batchDate(''), '')
  assert.equal(batchDate(null), '')
})

test('批号日期:月份/日期越界时当没有日期(不猜)', () => {
  assert.equal(batchDate('X-20261340'), '')
})

test('先进先出:日期在前先出,取不到日期的排最后', () => {
  const rows = [
    { 存货编码: 'A', 批号: 'ZZ-20261001', 仓库编码: 'W1', 现存量: 5 },
    { 存货编码: 'A', 批号: 'AA-20260901', 仓库编码: 'W1', 现存量: 5 },
    { 存货编码: 'A', 批号: '', 仓库编码: 'W1', 现存量: 5 },
  ]
  const sorted = fifoSort(rows).map((r) => r.批号)
  assert.deepEqual(sorted, ['AA-20260901', 'ZZ-20261001', ''])
})

test('可用量合计:只看 物料+仓库(多批次相加,不看批号)', () => {
  const rows = [
    { 存货编码: 'A', 批号: 'P1', 仓库编码: 'W1', 现存量: 3.5 },
    { 存货编码: 'A', 批号: 'P2', 仓库编码: 'W1', 现存量: 1.25 },
  ]
  assert.equal(sumAvailable(rows), 4.75)
})

test('分配:一批够 → 只出一行', () => {
  const rows = [{ 存货编码: 'A', 存货名称: '炭棒', 计量单位: '支', 批号: 'SX-20260901', 仓库: '原料仓', 仓库编码: 'YCL-01', 现存量: 100, 结存单价: 2 }]
  const r = allocateFifo(rows, 30)
  assert.equal(r.lines.length, 1)
  assert.equal(r.lines[0].qty, 30)
  assert.equal(r.allocated, 30)
  assert.equal(r.shortage, 0)
})

test('分配:一批不够 → 扣下一日期批次,生成多条明细', () => {
  const rows = [
    { 存货编码: 'A', 批号: 'SX-20260920', 仓库编码: 'W1', 仓库: '仓1', 现存量: 10 },
    { 存货编码: 'A', 批号: 'SX-20260905', 仓库编码: 'W1', 仓库: '仓1', 现存量: 10 },
    { 存货编码: 'A', 批号: 'SX-20260912', 仓库编码: 'W1', 仓库: '仓1', 现存量: 10 },
  ]
  const r = allocateFifo(rows, 25)
  assert.deepEqual(r.lines.map((l) => l.batch), ['SX-20260905', 'SX-20260912', 'SX-20260920'])
  assert.deepEqual(r.lines.map((l) => l.qty), [10, 10, 5])
  assert.equal(r.allocated, 25)
  assert.equal(r.shortage, 0)
})

test('分配:数量超过可用合计 → 全部分完并报缺口(不拦,交给审核闸门)', () => {
  const rows = [{ 存货编码: 'A', 批号: 'P1', 仓库编码: 'W1', 现存量: 4 }]
  const r = allocateFifo(rows, 6)
  assert.equal(r.allocated, 4)
  assert.equal(r.shortage, 2)
})

test('分配:数量非正/没有库存 → 不出行', () => {
  assert.deepEqual(allocateFifo([{ 现存量: 5 }], 0).lines, [])
  const r = allocateFifo([{ 存货编码: 'A', 现存量: 0 }], 3)
  assert.equal(r.lines.length, 0)
  assert.equal(r.shortage, 3)
})

test('建单:带工单键与仓位(追溯/回写要靠 加工单号+工单行号)', () => {
  const form = buildMaterialOutForm(
    [{ code: 'M-001', name: '端盖', uom: '个', batch: 'P1', warehouse: '原料仓', warehouseCode: 'YCL-01', binCode: 'A1-09-1', bin: 'A1-09-1', qty: 2, price: 1 }],
    { date: '2026-10-20', woNo: 'GD-2026-10-0001', woLine: 1, warehouseCode: 'YCL-01' },
  )
  assert.equal(form.加工单号, 'GD-2026-10-0001')
  assert.equal(form.工单行号, 1)
  assert.equal(form.detail.items[0].仓位编码, 'A1-09-1')
  assert.equal(form.detail.items[0].仓库编码, 'YCL-01')
})
