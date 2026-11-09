/**
 * unitPrecision.test.js — 数量按计量单位精度(2026-11-09 用户口径)前端纯函数单测。
 *
 * 钉住:个/卷=0 位、kg/米=3 位、未知单位 2 位;向下取整;双单位(数量2)按第 2 单位;
 * 非数量字段一律 null(金额/单价不受影响)。与后端 UnitPrecision 同口径。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

const { unitDecimalsOf, unitOfRow, qtyDecimalsOf, isQtyLabel, floorTo, formatQtyByUnit } = await import('./unitPrecision.js')

const MAP = { 个: 0, 卷: 0, kg: 3, 米: 3, pcs: 0 }

test('unitDecimalsOf:单位表优先,未知单位兜底 2 位,空单位 → null', () => {
  assert.equal(unitDecimalsOf(MAP, '个'), 0)
  assert.equal(unitDecimalsOf(MAP, '卷'), 0)
  assert.equal(unitDecimalsOf(MAP, 'KG'), 3)      // 大小写不敏感
  assert.equal(unitDecimalsOf(MAP, ' 米 '), 3)
  assert.equal(unitDecimalsOf(MAP, '未知单位'), 2)
  assert.equal(unitDecimalsOf(MAP, ''), null)
  assert.equal(unitDecimalsOf({}, '个'), 2)       // 配置没下发 → 兜底
})

test('unitOfRow/qtyDecimalsOf:只认数量类字段,且按行单位;双单位取第 2 单位', () => {
  assert.equal(unitOfRow({ 计量单位: '个' }), '个')
  assert.equal(unitOfRow({ 单位: 'kg' }), 'kg')
  assert.equal(unitOfRow({ 主单位: 'kg' }), 'kg')          // 库存报表用「主单位」
  assert.equal(qtyDecimalsOf('数量', { 计量单位: '个' }, MAP), 0)
  assert.equal(qtyDecimalsOf('实收数量', { 计量单位: 'kg' }, MAP), 3)
  assert.equal(qtyDecimalsOf('数量2', { 计量单位: '个', 计量单位2: 'kg' }, MAP), 3)
  assert.equal(qtyDecimalsOf('数量', { 计量单位: '未知' }, MAP), 2)
  // 库存报表:列名是 期初结存/期末结存,单位列是 主单位
  assert.equal(qtyDecimalsOf('期初结存', { 主单位: 'kg' }, MAP), 3)
  assert.equal(qtyDecimalsOf('期末结存', { 主单位: '个' }, MAP), 0)
  // 非数量字段 / 行上没有单位:null(不插手金额、单价、单位)
  assert.equal(qtyDecimalsOf('金额', { 计量单位: 'kg' }, MAP), null)
  assert.equal(qtyDecimalsOf('单价', { 计量单位: 'kg' }, MAP), null)
  assert.equal(qtyDecimalsOf('计量单位', { 计量单位: 'kg' }, MAP), null)
  assert.equal(qtyDecimalsOf('入库单号', { 计量单位: 'kg' }, MAP), null)
  assert.equal(qtyDecimalsOf('数量', {}, MAP), null)
})

test('isQtyLabel:结存/入库/出库算数量;金额/单价/单号/单位/仓库不算', () => {
  for (const k of ['数量', '实收数量', '期初结存', '期末结存', '本期入库', '本期出库']) {
    assert.equal(isQtyLabel(k), true, k)
  }
  for (const k of ['金额', '单价', '入库单号', '计量单位', '主单位', '仓库', '单据日期', '税额']) {
    assert.equal(isQtyLabel(k), false, k)
  }
})

test('floorTo:向下取整(4.6 个 → 4;304.6123 kg → 304.612)', () => {
  assert.equal(floorTo(4.6, 0), 4)
  assert.equal(floorTo(-1.2, 0), -2)
  assert.equal(floorTo(304.6123, 3), 304.612)
  assert.equal(floorTo(4.799999999999997, 0), 4)   // 超送同款浮点尾差
  assert.equal(floorTo(0.2 + 0.1, 1), 0.3)          // 0.30000000000000004 → 0.3
})

test('formatQtyByUnit:按单位位数显示、去掉尾随 0', () => {
  assert.equal(formatQtyByUnit(5000, 0), '5000')
  assert.equal(formatQtyByUnit(304.6, 3), '304.6')
  assert.equal(formatQtyByUnit(304.6123, 3), '304.612')
  assert.equal(formatQtyByUnit(2.4, 0), '2')
})
