import test from 'node:test'
import assert from 'node:assert/strict'
import { BARCODE_PANELS, barcodeLabelOf, barcodeLabelsOf } from './barcodeLabel.js'

test('三面板编码与后端/迁移脚本一致', () => {
  assert.deepEqual(BARCODE_PANELS, ['BARCODE_MAT', 'BARCODE_WIP', 'BARCODE_FIN'])
})

test('材料仓:名称取存货名称、数量取「数量」、单据取单据编号+单据日期', () => {
  const lb = barcodeLabelOf('BARCODE_MAT', {
    码内容: 'YJ-TS-033|PC0000', 存货名称: 'PP棉', 规格型号: '40±1*30+1*497.5±0.5',
    批号: 'PC0000', 数量: 2645, 计量单位: '支', 单据编号: 'CGRK-20261014-03414', 单据日期: '2026-10-14',
  })
  assert.equal(lb.code, 'YJ-TS-033|PC0000')
  assert.equal(lb.qrText, lb.code, '二维码文本=码内容(一批一码)')
  assert.equal(lb.name, 'PP棉 40±1*30+1*497.5±0.5')
  assert.equal(lb.lot, 'PC0000')
  assert.equal(lb.qty, 2645)
  assert.equal(lb.unit, '支')
  assert.equal(lb.doc, 'CGRK-20261014-03414 2026-10-14')
})

test('半成品:数量取「报工数量」、单据取报工单号+生产日期', () => {
  const lb = barcodeLabelOf('BARCODE_WIP', {
    码内容: 'A-32-26|20261014', 产品名称: 'A-32-26', 规格型号: '', 批号: '20261014',
    报工数量: 20, 计量单位: '支', 报工单号: 'BG-2026-10-0003', 生产日期: '2026-10-14',
  })
  assert.equal(lb.qty, 20)
  assert.equal(lb.doc, 'BG-2026-10-0003 2026-10-14')
  assert.equal(lb.name, 'A-32-26')
})

test('成品:数量取「实收数量」;批号为空时标签不带 LOT、码内容只剩产品编码', () => {
  const lb = barcodeLabelOf('BARCODE_FIN', {
    码内容: 'TS45', 产品名称: 'TS45', 批号: '', 实收数量: 123,
    计量单位: '支', 单据编号: 'CPRK-20261014-00005', 单据日期: '2026-10-14',
  })
  assert.equal(lb.code, 'TS45')
  assert.equal(lb.lot, '', '空批号不编造')
  assert.equal(lb.qty, 123)
})

test('空码行返回 null;批量映射丢弃空码并保持顺序', () => {
  assert.equal(barcodeLabelOf('BARCODE_MAT', { 码内容: '   ' }), null)
  assert.equal(barcodeLabelOf('UNKNOWN', { 码内容: 'x' }), null, '未知面板不产出标签')
  const list = barcodeLabelsOf('BARCODE_FIN', [
    { 码内容: 'A|1', 产品名称: 'A', 实收数量: 1 },
    { 码内容: '', 产品名称: 'B' },
    { 码内容: 'C|2', 产品名称: 'C', 实收数量: 2 },
  ])
  assert.deepEqual(list.map((l) => l.code), ['A|1', 'C|2'])
})
