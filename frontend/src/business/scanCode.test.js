import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  splitScan, parseWorkOrderCode, parseMaterialCode,
  makeBatchRows, autoAllocateFifo, isNonFifo, selectedBatchRows, selectedTotal, checkSelection,
} from './scanCode.js'

/**
 * scanCode.test.js — 现场标签码解析 + 批次勾选/先进先出(2026-10-21)
 *
 * 用用户给的真实码型钉边界:
 *   工单 `0@GD-2026-10-0221@1001`(1001 = 1000 固定前缀 + 行号 1)
 *   商品 `0@YJ-ZZ-001`
 *   采购 `0@YJ-ZZ-001@20261021`
 */

test('切段:工单码 → 去掉占位,剩工单号 + 行号段', () => {
  assert.deepEqual(splitScan('0@GD-2026-10-0221@1001'), ['GD-2026-10-0221', '1001'])
})

test('切段:商品码 → 只有物料编码', () => {
  assert.deepEqual(splitScan('0@YJ-ZZ-001'), ['YJ-ZZ-001'])
})

test('切段:采购标识码 → 物料编码 + 批次', () => {
  assert.deepEqual(splitScan('0@YJ-ZZ-001@20261021'), ['YJ-ZZ-001', '20261021'])
})

test('切段:无分隔符的老标签原样一段', () => {
  assert.deepEqual(splitScan('S062'), ['S062'])
})

test('切段:兼容历史 | 分隔符', () => {
  assert.deepEqual(splitScan('0|C5191H-0D20|20260826'), ['C5191H-0D20', '20260826'])
})

test('切段:空串 → 空数组', () => {
  assert.deepEqual(splitScan(''), [])
  assert.deepEqual(splitScan('   '), [])
})

test('工单码:1001 → 行号 1(减掉固定的 1000)', () => {
  assert.deepEqual(parseWorkOrderCode('0@GD-2026-10-0221@1001'), { ok: true, wo: 'GD-2026-10-0221', line: 1 })
})

test('工单码:1007 → 行号 7', () => {
  assert.equal(parseWorkOrderCode('0@GD-2026-10-0221@1007').line, 7)
})

test('工单码:只有工单号(手输) → 行号 0 表示未指定', () => {
  assert.deepEqual(parseWorkOrderCode('GD-2026-10-0221'), { ok: true, wo: 'GD-2026-10-0221', line: 0 })
})

test('工单码:空串 → empty', () => {
  assert.equal(parseWorkOrderCode('').reason, 'empty')
})

test('物料码:商品码不带批次', () => {
  assert.deepEqual(parseMaterialCode('0@YJ-ZZ-001'), { ok: true, code: 'YJ-ZZ-001', batch: '' })
})

test('物料码:采购标识码带批次', () => {
  assert.deepEqual(parseMaterialCode('0@YJ-ZZ-001@20261021'), { ok: true, code: 'YJ-ZZ-001', batch: '20261021' })
})

test('物料码:空串 → empty', () => {
  assert.equal(parseMaterialCode('').reason, 'empty')
})

/** 三个批次的库存行:批次日期 0901 / 0915 / 1001(故意乱序传入) */
const ROWS = [
  { 存货编码: 'M1', 存货名称: '料一', 计量单位: 'KG', 批号: 'TL-20261001', 仓库: '原料仓', 仓库编码: 'CK01', 现存量: 30, 结存单价: 2 },
  { 存货编码: 'M1', 存货名称: '料一', 计量单位: 'KG', 批号: 'TL-20260901', 仓库: '原料仓', 仓库编码: 'CK01', 现存量: 10, 结存单价: 2 },
  { 存货编码: 'M1', 存货名称: '料一', 计量单位: 'KG', 批号: 'TL-20260915', 仓库: '原料仓', 仓库编码: 'CK01', 现存量: 20, 结存单价: 2 },
]

test('批次行:按批号日期先进先出排序', () => {
  const rows = makeBatchRows(ROWS)
  assert.deepEqual(rows.map((b) => b.lot), ['TL-20260901', 'TL-20260915', 'TL-20261001'])
  assert.deepEqual(rows.map((b) => b.avail), [10, 20, 30])
})

test('批次行:扫到的批次被标记 scanned', () => {
  const rows = makeBatchRows(ROWS, 'TL-20260915')
  assert.deepEqual(rows.map((b) => b.scanned), [false, true, false])
})

test('批次行:默认不勾选、数量为 0', () => {
  const rows = makeBatchRows(ROWS)
  assert.equal(rows.every((b) => b.qty === 0 && b.checked === false), true)
})

test('默认分配:领 15 → 先扣 0901 的 10,再扣 0915 的 5', () => {
  const rows = autoAllocateFifo(makeBatchRows(ROWS), 15)
  assert.deepEqual(rows.map((b) => b.qty), [10, 5, 0])
  assert.deepEqual(rows.map((b) => b.checked), [true, true, false])
})

test('默认分配:领 50 → 三批全扣满', () => {
  const rows = autoAllocateFifo(makeBatchRows(ROWS), 50)
  assert.deepEqual(rows.map((b) => b.qty), [10, 20, 20])
})

test('默认分配:不改入参(纯函数)', () => {
  const base = makeBatchRows(ROWS)
  autoAllocateFifo(base, 15)
  assert.equal(base.every((b) => b.qty === 0), true)
})

test('先进先出判定:按 FIFO 领 → 合规', () => {
  assert.equal(isNonFifo(autoAllocateFifo(makeBatchRows(ROWS), 15)), false)
})

test('先进先出判定:只领最早一批的一部分 → 合规', () => {
  const rows = makeBatchRows(ROWS).map((b) => (b.lot === 'TL-20260901' ? { ...b, qty: 3 } : b))
  assert.equal(isNonFifo(rows), false)
})

test('先进先出判定:跳过最早的批次去领后面的 → 违反', () => {
  const rows = makeBatchRows(ROWS).map((b) => (b.lot === 'TL-20261001' ? { ...b, qty: 5 } : b))
  assert.equal(isNonFifo(rows), true)
})

test('先进先出判定:先领满 0901、跳过 0915 去领 1001 → 违反', () => {
  const rows = makeBatchRows(ROWS).map((b) => {
    if (b.lot === 'TL-20260901') return { ...b, qty: 10 }
    if (b.lot === 'TL-20261001') return { ...b, qty: 5 }
    return b
  })
  assert.equal(isNonFifo(rows), true)
})

test('已选行合计', () => {
  const rows = autoAllocateFifo(makeBatchRows(ROWS), 15)
  assert.equal(selectedTotal(rows), 15)
  assert.equal(selectedBatchRows(rows).length, 2)
})

test('超领校验:勾选超过总可用量 → 不通过并给出超出量', () => {
  // 手工把每批都勾成 999(模拟用户乱填),总可用 = 10+20+30 = 60
  const rows = makeBatchRows(ROWS).map((b) => ({ ...b, qty: 999, checked: true }))
  const r = checkSelection(rows, 999)
  assert.equal(r.ok, false)
  assert.equal(r.over, 999 * 3 - 60)
})

test('超领校验:勾选超过需求 → 不通过并给出超出量', () => {
  const rows = autoAllocateFifo(makeBatchRows(ROWS), 15)
  const r = checkSelection(rows, 10)
  assert.equal(r.ok, false)
  assert.equal(r.over, 5)
})

test('超领校验:正常勾选 → 通过', () => {
  const rows = autoAllocateFifo(makeBatchRows(ROWS), 15)
  assert.deepEqual(checkSelection(rows, 15), { ok: true, over: 0 })
})
