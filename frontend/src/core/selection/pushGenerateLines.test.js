import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDocsPayload,
  capOf,
  defaultPickKeys,
  docSummary,
  isPrintedRow,
  mixedBatchBlocked,
  pickedCount,
  picksOf,
  printedBatchesOf,
  rowSelectable,
  sumPicked,
} from './pushGenerateLines.js'

/**
 * pushGenerateLines.test.js — 统一生单对话框(勾选行 + 本次数量)的纯函数单测
 *
 * 覆盖用户口径(2026-10-31):
 *   ① 生单要能**勾选**、能**选数量**(未勾选/数量 0 的行不进新单);
 *   ② 批量生单 = 多张来源单一起挑行 → 每张单各自生成一条提交体;
 *   ③ 分批链路按批次号拆分;已打印隔离行必须显式勾、且不能与未打印量混在多个批次号里;
 *   ④ 可生单上限与后端同公式(超送比例),隔离行按服务端上限(不可超)。
 */

const orderRow = (key, qty, sent = 0, returned = 0, extra = {}) => ({
  lineKey: key, rowKind: 'order', 数量: qty, 已送数量: sent, 已退回数量: returned, 剩余数量: qty - sent + returned, ...extra,
})
const printedRow = (key, qty, sent, batch) => ({
  lineKey: key, rowKind: 'printed', 数量: qty, 已送数量: sent, 剩余数量: qty - sent, 可送上限: qty - sent, 批次号: batch,
})

test('capOf:订单行按「数量×(1+比例)−已送+已退回」,隔离行按服务端上限', () => {
  assert.equal(capOf(orderRow('A#1', 100, 40), 0), 60)
  assert.equal(capOf(orderRow('A#1', 100, 40), 10), 70)
  assert.equal(capOf(orderRow('A#1', 100, 40, 5), 0), 65)
  // 隔离行:即使比例 50% 也不能超过未生单量(印在标签上的量是定死的)
  assert.equal(capOf(printedRow('A#1@9', 50, 10, '20261031'), 50), 40)
  assert.equal(capOf(null), 0)
})

test('rowSelectable:没剩余/没额度 → 不可勾', () => {
  assert.equal(rowSelectable(orderRow('A#1', 100, 100)), false)
  assert.equal(rowSelectable(orderRow('A#1', 100, 90)), true)
  assert.equal(rowSelectable(printedRow('A#1@9', 50, 50, 'B1')), false)
})

test('defaultPickKeys:只默认勾有剩余的订单行,隔离行必须显式勾', () => {
  const rows = [orderRow('A#1', 100), orderRow('A#2', 0), printedRow('A#1@9', 50, 0, 'B1')]
  assert.deepEqual(defaultPickKeys(rows), ['A#1'])
})

test('buildDocsPayload:未勾选的行不进提交体(只勾一行不会全送)', () => {
  const docs = [{ sourceNo: 'A', batchFlow: false, lines: [orderRow('A#1', 100), orderRow('A#2', 200)] }]
  const payload = buildDocsPayload(docs, { A: new Set(['A#1']) }, { 'A#1': 30, 'A#2': 200 })
  assert.equal(payload.length, 1)
  assert.deepEqual(payload[0], { sourceNo: 'A', lines: [{ lineKey: 'A#1', qty: 30 }] })
})

test('buildDocsPayload:勾了但数量填 0 视为不送', () => {
  const docs = [{ sourceNo: 'A', lines: [orderRow('A#1', 100)] }]
  assert.deepEqual(buildDocsPayload(docs, { A: ['A#1'] }, { 'A#1': 0 }), [])
})

test('buildDocsPayload:批量生单 = 每张来源单一条(多张单各自生成)', () => {
  const docs = [
    { sourceNo: 'A', lines: [orderRow('A#1', 100)] },
    { sourceNo: 'B', lines: [orderRow('B#1', 50)] },
    { sourceNo: 'C', lines: [orderRow('C#1', 10)] },
  ]
  const payload = buildDocsPayload(docs, { A: ['A#1'], B: ['B#1'] }, { 'A#1': 100, 'B#1': 20, 'C#1': 10 })
  assert.deepEqual(payload, [
    { sourceNo: 'A', lines: [{ lineKey: 'A#1', qty: 100 }] },
    { sourceNo: 'B', lines: [{ lineKey: 'B#1', qty: 20 }] },
  ])
})

test('buildDocsPayload:分批链路带批次号;多个已打印批次号按号拆成多张单', () => {
  const docs = [{
    sourceNo: 'PO1', batchFlow: true, batchNo: '20261031',
    lines: [
      orderRow('PO1#1', 100),
      printedRow('PO1#1@7', 40, 0, '20261020'),
      printedRow('PO1#1@8', 30, 0, '20261021'),
    ],
  }]
  const payload = buildDocsPayload(docs, { PO1: ['PO1#1', 'PO1#1@7', 'PO1#1@8'] }, { 'PO1#1': 10, 'PO1#1@7': 40, 'PO1#1@8': 30 })
  assert.equal(payload.length, 3)
  assert.deepEqual(payload.map((p) => p.batchNo).sort(), ['20261020', '20261021', '20261031'])
  assert.deepEqual(payload.find((p) => p.batchNo === '20261031').lines, [{ lineKey: 'PO1#1', qty: 10 }])
})

test('printedBatchesOf / mixedBatchBlocked:多批次 + 未打印量必须拦下', () => {
  const doc = {
    sourceNo: 'PO1', batchFlow: true, batchNo: '20261031',
    lines: [orderRow('PO1#1', 100), printedRow('PO1#1@7', 40, 0, 'B1'), printedRow('PO1#1@8', 30, 0, 'B2')],
  }
  const all = ['PO1#1', 'PO1#1@7', 'PO1#1@8']
  assert.deepEqual(printedBatchesOf(doc, all.map((k) => ({ lineKey: k }))), ['B1', 'B2'])
  assert.match(mixedBatchBlocked([doc], { PO1: all }, { 'PO1#1': 1, 'PO1#1@7': 40, 'PO1#1@8': 30 }), /多个已打印批次号/)
  // 只勾已有打印行(不含未打印量):放行,由 buildDocsPayload 拆单
  assert.equal(mixedBatchBlocked([doc], { PO1: ['PO1#1@7', 'PO1#1@8'] }, { 'PO1#1@7': 40, 'PO1#1@8': 30 }), '')
  // 普通链路不受这条限制
  assert.equal(mixedBatchBlocked([{ sourceNo: 'A', lines: [orderRow('A#1', 1)] }], { A: ['A#1'] }, { 'A#1': 1 }), '')
})

test('sumPicked / pickedCount:合计只算已勾选并填了量的行', () => {
  const docs = [{ sourceNo: 'A', lines: [orderRow('A#1', 100), orderRow('A#2', 200)] }]
  const picked = { A: new Set(['A#1', 'A#2']) }
  assert.equal(sumPicked(docs, picked, { 'A#1': 30, 'A#2': 0 }), 30)
  assert.equal(pickedCount(docs, picked), 2)
})

test('docSummary:日期 + 往来单位(缺字段时自动跳过)', () => {
  assert.equal(docSummary({ 单据日期: '2026-10-31 08:00:00', 供应商: 'YJ-WR' }), '2026-10-31 · YJ-WR')
  assert.equal(docSummary({ 日期: '2026-10-30', 客户: 'C1' }), '2026-10-30 · C1')
  assert.equal(docSummary({}), '')
})

test('isPrintedRow:只有 rowKind=printed 才算隔离行', () => {
  assert.equal(isPrintedRow({ rowKind: 'printed' }), true)
  assert.equal(isPrintedRow({ rowKind: 'order' }), false)
  assert.equal(isPrintedRow(null), false)
})

test('picksOf:数组/Set 都归一成 Set(组件里存数组,纯函数收哪样都行)', () => {
  assert.deepEqual([...picksOf(['A#1', 'A#2'])], ['A#1', 'A#2'])
  assert.deepEqual([...picksOf(new Set(['A#1']))], ['A#1'])
  assert.equal(picksOf(undefined).size, 0)
})
