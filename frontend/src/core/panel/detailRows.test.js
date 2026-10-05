import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detailKeyOf, detailRowsOf, ensureDetailRows } from './detailRows.js'

test('单据面板:键固定 items', () => {
  const head = { detail: { items: [{ 检验项: '外观' }] } }
  assert.equal(detailKeyOf(head), 'items')
  assert.deepEqual(detailRowsOf(head), [{ 检验项: '外观' }])
})

test('档案面板:键 = LOWER(panel_code),照 detail.items 取会漏光(实测 QC_INSP_REQ=detail.qc_insp_req)', () => {
  const head = { detail: { qc_insp_req: [{ id: 1 }, { id: 2 }] } }
  assert.equal(detailKeyOf(head, 'qc_insp_req'), 'qc_insp_req')
  assert.equal(detailRowsOf(head, 'qc_insp_req').length, 2)
  // 不传 fallback 也能认出那个键(取第一个数组值)
  assert.equal(detailKeyOf(head), 'qc_insp_req')
})

test('detail 里没有数组 / 结构不对 ⇒ 空数组,不报错', () => {
  assert.deepEqual(detailRowsOf({ detail: {} }, 'inv'), [])
  assert.deepEqual(detailRowsOf({}, 'inv'), [])
  assert.deepEqual(detailRowsOf(null), [])
  assert.deepEqual(detailRowsOf({ detail: { 编号: 'x' } }, 'inv'), [])
})

test('items 优先于其它数组键(单据面板里混进别的键时不许被抢走)', () => {
  const head = { detail: { files: [], items: [{ id: 9 }] } }
  assert.equal(detailKeyOf(head), 'items')
  assert.equal(detailRowsOf(head)[0].id, 9)
})

test('ensureDetailRows:写进同一个键(键错位会让新行既不在表里也不在提交内容里)', () => {
  const arch = { detail: { qc_insp_req: [{ id: 1 }] } }
  ensureDetailRows(arch, 'qc_insp_req').push({ 检验项: '外径' })
  assert.deepEqual(Object.keys(arch.detail), ['qc_insp_req'], '不得另起 items 键')
  assert.equal(arch.detail.qc_insp_req.length, 2)

  const empty = {}
  ensureDetailRows(empty, 'qc_insp_req').push({ id: 3 })
  assert.deepEqual(empty, { detail: { qc_insp_req: [{ id: 3 }] } }, '缺 detail 时按 fallback 建键')
})

/** 源码级回归:档案面板的专属表格不许再写死 detail.items */
test('页面接线:来料检验要求组件与取数走 detailKey 判据', () => {
  const sheet = readFileSync(new URL('../views/QcInspReqSheet.vue', import.meta.url), 'utf8')
  assert.match(sheet, /detailRowsOf|ensureDetailRows/, 'QcInspReqSheet 必须经 detailRows 取/写行')
  assert.doesNotMatch(sheet, /detail\.items/, 'QcInspReqSheet 不许再写死 detail.items(档案面板键是 qc_insp_req)')
  const api = readFileSync(new URL('../qc/qcInspReqApi.js', import.meta.url), 'utf8')
  assert.match(api, /detailRowsOf/, '取数同样按 detailKey 判据')
})
