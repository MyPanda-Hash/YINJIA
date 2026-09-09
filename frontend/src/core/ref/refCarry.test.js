import test from 'node:test'
import assert from 'node:assert/strict'
import { applyRefCarry, refConfigOf, refShowsCode } from './refCarry.js'

const ref = {
  map: [
    { from: '存货编码', to: '存货编码' },
    { from: '规格型号', to: '规格型号' },
    { from: '计量单位', to: '销售单位' },
    { from: '参考成本', to: '单价' },
  ],
}

test('carries mapped fields from the picked source row onto the target', () => {
  const form = { 存货名称: '成品A' }
  applyRefCarry(form, { 存货编码: 'CP001', 规格型号: 'GX-1', 计量单位: '件', 参考成本: 12.5, 备注: '源行多余字段' }, ref, '存货名称')
  assert.deepEqual(form, { 存货名称: '成品A', 存货编码: 'CP001', 规格型号: 'GX-1', 销售单位: '件', 单价: 12.5 })
})

test('skips the main field itself so it keeps the refField value', () => {
  const form = { 单位: '' }
  applyRefCarry(form, { 计量单位: '套' }, { map: [{ from: '计量单位', to: '单位' }] }, '单位')
  assert.equal(form.单位, '')
})

test('skips mapping when the source row lacks the from value, keeps present ones', () => {
  const form = { 规格型号: '手填保留', 销售单位: 'PCS' }
  applyRefCarry(form, { 存货编码: 'CP002', 规格型号: undefined }, ref, '存货名称')
  assert.deepEqual(form, { 规格型号: '手填保留', 销售单位: 'PCS', 存货编码: 'CP002' })
})

test('supports refMap alias and from-as-to fallback, tolerates null/undefined config', () => {
  const form = {}
  applyRefCarry(form, { 数量: 3, 备注: 'x' }, { refMap: [{ from: '数量' }, null] }, '主字段')
  assert.deepEqual(form, { 数量: 3 })
  applyRefCarry(form, { 数量: 3 }, undefined, '主字段')
  applyRefCarry(form, { 数量: 3 }, {}, '主字段')
  assert.deepEqual(form, { 数量: 3 })
})

test('refConfigOf unwraps meta.ref object and passes list-config fields through', () => {
  const metaField = { code: '供应商编码', ref: { field: '往来单位编码', display: '往来单位名称' } }
  assert.equal(refConfigOf(metaField), metaField.ref)
  const listField = { refPanel: 'PARTNER', refField: '往来单位编码', displayField: '往来单位名称' }
  assert.equal(refConfigOf(listField), listField)
})

test('refShowsCode is true only when refField differs from displayField', () => {
  assert.ok(refShowsCode({ ref: { field: '往来单位编码', display: '往来单位名称' } }))
  assert.ok(refShowsCode({ refField: '往来单位编码', displayField: '往来单位名称' }))
  assert.ok(!refShowsCode({ ref: { field: '往来单位名称', display: '往来单位名称' } }))
  assert.ok(!refShowsCode({ ref: { field: '往来单位名称' } }))
  assert.ok(!refShowsCode({}))
})
