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

test('材料仓标签:带仓库(映射后)/供应商;仓位列存在但值为空 ⇒ 空串(标签不显示)', () => {
  const lb = barcodeLabelOf('BARCODE_MAT', {
    码内容: 'YJ-TS-033|20261014001', 存货名称: 'PP棉', 数量: 1, 批号: '20261014001',
    仓库映射: '材料仓', 供应商: '深圳市陶氏水处理设备技术开发有限公司', 仓位: '',
  })
  assert.equal(lb.warehouse, '材料仓')
  assert.equal(lb.supplier, '深圳市陶氏水处理设备技术开发有限公司')
  assert.equal(lb.bin, '', '没有仓位数据 → 空串,标签模板据此不渲染')
})

test('成品仓标签:只有仓库名;供应商与仓库一律空串', () => {
  const lb = barcodeLabelOf('BARCODE_FIN', {
    码内容: 'TS45|20261014001', 产品名称: 'TS45', 批号: '20261014001', 实收数量: 123,
    计量单位: 'kg', 单据编号: 'CPRK-20261014-00005', 单据日期: '2026-10-14', 仓库名称: '恒亿仓',
  })
  assert.equal(lb.warehouse, '恒亿仓')
  assert.equal(lb.supplier, '')
  assert.equal(lb.bin, '')
})

test('半成品仓标签:仓库/供应商/仓位都没有(报工派生)→ 全空串', () => {
  const lb = barcodeLabelOf('BARCODE_WIP', {
    码内容: 'S022-4|20261014', 产品名称: 'A+级烧结炭棒/滤芯', 批号: '20261014',
    报工数量: 160, 计量单位: '支', 报工单号: 'BG-2026-10-0001', 生产日期: '2026-10-16',
  })
  assert.equal(lb.warehouse, '')
  assert.equal(lb.supplier, '')
  assert.equal(lb.bin, '')
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
