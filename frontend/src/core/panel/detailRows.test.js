import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { detailKeyOf, detailRowsOf, ensureDetailRows, blankRowOf } from './detailRows.js'

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

/**
 * 新行默认值(2026-11-17 用户口径「只有不合格数量可以出现自动填 0 的情况」)
 *
 * 背景:所有 小数/整数 原来一律 `defaultValue ?? 0`,于是来料检验单「新增数据」造出的行
 * **合格数量是 0 而不是空**;0 算"已填" ⇒ 必填校验与审核闸门都拦不住 ⇒ 审完一行都进不了采购入库。
 */
test('blankRowOf:必填的数量字段留空,非必填的数量才预填 0', () => {
  const row = blankRowOf([
    { dataName: '物料编码', dataType: '参照', isRequired: true },
    { dataName: '送检数量', dataType: '小数', isRequired: false },
    { dataName: '合格数量', dataType: '小数', isRequired: true },
    { dataName: '不合格数量', dataType: '小数', isRequired: false },
    { dataName: '报废数量', dataType: '整数', isRequired: true },
    { dataName: '生产日期', dataType: '日期', isRequired: false },
    { dataName: '特采', dataType: '是否', isRequired: false },
  ])
  assert.equal(row['合格数量'], '', '必填的小数(合格数量)不许预填 0')
  assert.equal(row['报废数量'], '', '必填的整数同样不预填 0')
  assert.equal(row['不合格数量'], 0, '非必填的小数照老口径预填 0(用户明确允许)')
  assert.equal(row['送检数量'], 0, '非必填的数量照旧')
  assert.equal(row['物料编码'], '', '文本/参照仍是空串')
  assert.equal(row['生产日期'], '', '日期仍是空串')
  assert.equal(row['特采'], false, '是否仍是 false')
})

test('blankRowOf:字段自带的 defaultValue 优先于"必填留空/非必填 0"', () => {
  const row = blankRowOf([
    { dataName: '合格数量', dataType: '小数', isRequired: true, defaultValue: 5 },
    { dataName: '不合格数量', dataType: '小数', defaultValue: 2 },
  ])
  assert.equal(row['合格数量'], 5, '显式默认值优先')
  assert.equal(row['不合格数量'], 2)
})

test('blankRowOf:空字段表 / 脏字段不炸', () => {
  assert.deepEqual(blankRowOf(), {})
  assert.deepEqual(blankRowOf(null), {})
  assert.deepEqual(blankRowOf([null, {}, { dataName: '数量', dataType: '小数' }]), { 数量: 0 })
})

/** 源码级回归:四个新行构造点都必须走 blankRowOf,不许再各写一份 `defaultValue ?? 0` */
test('页面接线:PanelxList / PanelxForm / NewVoucherDialog 的新行都走 blankRowOf', () => {
  for (const f of ['PanelxList', 'PanelxForm', 'NewVoucherDialog']) {
    const src = readFileSync(new URL(`../views/${f}.vue`, import.meta.url), 'utf8')
    assert.match(src, /blankRowOf\(/, `${f} 的新行要用 blankRowOf`)
    assert.doesNotMatch(src, /defaultValue \?\? 0/, `${f} 不许再自己写 defaultValue ?? 0(会把必填数量预填成 0)`)
  }
})
