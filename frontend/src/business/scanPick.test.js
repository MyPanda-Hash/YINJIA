import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBarcode, matchPickRows, checkPickQty, buildMaterialOutForm } from './scanPick.js'

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
