import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LOT, isDefaultLot, lotOf, defaultLotFirst, allocOrder,
  checkByNeed, allocateChecked, checkAll, allCheckedState,
} from './batchAlloc.js'

/**
 * batchAlloc.test.js — 「扫码出库」批次勾选与按序扣减(2026-11-28)
 *
 * 钉住用户口径:
 *   ① PC0000 永远排第一批(它是金蝶不分批商品的默认批号,现场真正的货压在这一批上);
 *   ② 只扣勾选的批次,勾选顺序 = 表格顺序(PC0000 → 日期在前的 → …);
 *   ③ 数量自动按顺序填满,一批不够自动落到下一批;勾选不够时给出 shortage;
 *   ④ 扫到的码里带了批号 ⇒ 那一批优先扣。
 */

/** 三种行:PC0000(无日期)+ 两个有日期的批次(故意乱序传入) */
const batchRows = [
  { lot: 'TL-20261001', avail: 30, checked: false, qty: 0 },
  { lot: 'PC0000', avail: 5, checked: false, qty: 0 },
  { lot: 'TL-20260901', avail: 10, checked: false, qty: 0 },
]

test('默认批号:PC0000 大小写/空格都认,别的批号不是', () => {
  assert.equal(DEFAULT_LOT, 'PC0000')
  assert.equal(isDefaultLot('PC0000'), true)
  assert.equal(isDefaultLot(' pc0000 '), true)
  assert.equal(isDefaultLot('P0000'), false, 'P0000 不是默认批号,不能误当 PC0000')
  assert.equal(isDefaultLot(''), false)
  assert.equal(isDefaultLot(null), false)
})

test('取批号:页面批次行用 lot,原始库存行用 批号', () => {
  assert.equal(lotOf({ lot: 'L1' }), 'L1')
  assert.equal(lotOf({ 批号: 'L2' }), 'L2')
  assert.equal(lotOf({ lot: '', 批号: 'L3' }), '', 'lot 存在(哪怕空)就以 lot 为准')
  assert.equal(lotOf(null), '')
})

test('PC0000 提到最前,其余保持传入顺序(稳定)', () => {
  const sorted = defaultLotFirst(batchRows)
  assert.deepEqual(sorted.map((b) => b.lot), ['PC0000', 'TL-20261001', 'TL-20260901'])
  assert.deepEqual(batchRows.map((b) => b.lot), ['TL-20261001', 'PC0000', 'TL-20260901'], '不改入参')
})

test('PC0000 提到最前:原始库存行同样生效', () => {
  const stock = [{ 批号: 'A' }, { 批号: 'PC0000' }, { 批号: '' }]
  assert.deepEqual(defaultLotFirst(stock).map((r) => r.批号), ['PC0000', 'A', ''])
})

test('扣减顺序:默认按显示顺序;带批号时那一批最前', () => {
  const rows = defaultLotFirst(batchRows)
  assert.deepEqual(allocOrder(rows), [0, 1, 2])
  assert.deepEqual(allocOrder(rows, 'TL-20260901'), [2, 0, 1], '扫到的批排最前,其余保持显示顺序')
})

test('默认勾选:按顺序勾到够本次数量为止', () => {
  const rows = defaultLotFirst(batchRows)   // PC0000=5, 1001=30, 0901=10
  const checked = checkByNeed(rows, 12)
  assert.deepEqual(checked.map((b) => b.checked), [true, true, false], '5 + 30 ≥ 12 ⇒ 勾前两批就够')
  assert.deepEqual(checked.map((b) => b.qty), [0, 0, 0], '勾选不填数量,由 allocateChecked 填')
})

test('默认勾选:数量为 0 ⇒ 一批都不勾(与旧行为一致)', () => {
  const rows = checkByNeed(defaultLotFirst(batchRows), 0)
  assert.equal(rows.every((b) => !b.checked), true)
})

test('默认勾选:数量超过总可用 ⇒ 有货的全勾上', () => {
  const rows = checkByNeed(defaultLotFirst(batchRows), 999)
  assert.equal(rows.every((b) => b.checked), true)
})

test('自动填入:勾选后按顺序扣,一批不够落下一批', () => {
  const rows = checkByNeed(defaultLotFirst(batchRows), 12)   // 勾 PC0000(5) + 1001(30)
  const r = allocateChecked(rows, 12)
  assert.deepEqual(r.rows.map((b) => b.qty), [5, 7, 0], '先扣 PC0000 的 5,再从下一批扣 7')
  assert.equal(r.allocated, 12)
  assert.equal(r.shortage, 0)
})

test('自动填入:没勾的批次数量必须为 0', () => {
  const rows = defaultLotFirst(batchRows).map((b) => ({ ...b, checked: b.lot !== 'TL-20260901' }))
  const r = allocateChecked(rows, 100)
  assert.deepEqual(r.rows.map((b) => b.qty), [5, 30, 0])
  assert.equal(r.shortage, 65, '勾选总量只有 35,还差 65')
})

test('自动填入:取消勾选后就从别的勾选批次里扣', () => {
  const rows = defaultLotFirst(batchRows).map((b) => ({ ...b, checked: b.lot !== 'PC0000' }))
  const r = allocateChecked(rows, 8)
  assert.deepEqual(r.rows.map((b) => b.qty), [0, 8, 0], 'PC0000 没勾 ⇒ 一分都不从它扣')
  assert.equal(r.shortage, 0)
})

test('自动填入:扫到的批号优先扣(哪怕它不是 PC0000)', () => {
  const rows = checkByNeed(defaultLotFirst(batchRows), 8, { firstLot: 'TL-20260901' })
  // 勾选:先勾扫到的 0901(10 可覆盖 8)
  assert.deepEqual(rows.map((b) => b.checked), [false, false, true])
  const r = allocateChecked(rows, 8, { firstLot: 'TL-20260901' })
  assert.deepEqual(r.rows.map((b) => b.qty), [0, 0, 8])
})

test('自动填入:数量 0 / 负数 ⇒ 全部归零', () => {
  const rows = defaultLotFirst(batchRows).map((b) => ({ ...b, checked: true, qty: 3 }))
  assert.equal(allocateChecked(rows, 0).allocated, 0)
  assert.equal(allocateChecked(rows, -5).allocated, 0)
  assert.equal(allocateChecked(rows, 0).rows.every((b) => b.qty === 0), true)
})

test('自动填入:不改入参(纯函数)', () => {
  const rows = checkByNeed(defaultLotFirst(batchRows), 12)
  allocateChecked(rows, 12)
  assert.equal(rows.every((b) => b.qty === 0), true)
})

test('全选 / 全不选', () => {
  const all = checkAll(batchRows, true)
  assert.equal(all.every((b) => b.checked), true)
  const none = checkAll(all, false)
  assert.equal(none.every((b) => !b.checked), true)
})

test('表头全选框状态:全不勾=false / 全勾=true / 一半=indeterminate', () => {
  assert.equal(allCheckedState([{ avail: 5, checked: false }]), false)
  assert.equal(allCheckedState([{ avail: 5, checked: true }, { avail: 3, checked: true }]), true)
  assert.equal(allCheckedState([{ avail: 5, checked: true }, { avail: 3, checked: false }]), 'indeterminate')
  assert.equal(allCheckedState([{ avail: 0, checked: false }, { avail: 3, checked: true }]), true,
    '可用量为 0 的批次不参与全选框判断')
})
