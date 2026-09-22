import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickedKeySet, defaultPickKeys, buildBatchSendLines, sumPickedQty,
} from './batchSendLines.js'

/**
 * 守 2026-09-21 用户报的缺陷:「生单勾选明细时,只勾选一条生成也会变成全部生单」。
 * 病根:对话框打开时给每一行都预填了「本次送料量 = 剩余量」,而 confirm() 只按 qty>0 过滤、
 * 完全没用勾选 → 只勾一行也提交全部行。这组断言把"勾选是权威"钉死。
 */

const ROWS = [
  { lineKey: 'PO#1', 剩余数量: 10 },
  { lineKey: 'PO#2', 剩余数量: 20 },
  { lineKey: 'PO#3', 剩余数量: 0 },     // 已送满
]
const ALL_FILLED = { 'PO#1': 10, 'PO#2': 20, 'PO#3': 0 }

test('核心回归:只勾选一行 → 只生成那一行(即使别的行也预填了数量)', () => {
  const lines = buildBatchSendLines(ROWS, ['PO#1'], ALL_FILLED)
  assert.deepEqual(lines, [{ lineKey: 'PO#1', qty: 10 }])
})

test('核心回归:未勾选的行即使填了量也不生成', () => {
  const lines = buildBatchSendLines(ROWS, ['PO#2'], { 'PO#1': 10, 'PO#2': 20 })
  assert.deepEqual(lines, [{ lineKey: 'PO#2', qty: 20 }])
})

test('全选 → 全部有量的行都生成', () => {
  const lines = buildBatchSendLines(ROWS, ['PO#1', 'PO#2', 'PO#3'], ALL_FILLED)
  assert.deepEqual(lines, [{ lineKey: 'PO#1', qty: 10 }, { lineKey: 'PO#2', qty: 20 }])
})

test('勾了但本次送料量为 0/空 → 不生成该行', () => {
  assert.deepEqual(buildBatchSendLines(ROWS, ['PO#1'], { 'PO#1': 0 }), [])
  assert.deepEqual(buildBatchSendLines(ROWS, ['PO#1'], {}), [])
})

test('一个都没勾 → 空的 payload(组件据此提示"请至少勾选一行")', () => {
  assert.deepEqual(buildBatchSendLines(ROWS, [], ALL_FILLED), [])
})

test('pickedKeySet(=el-table 选中行数组)与 Set 两种入参等价', () => {
  const picked = [ROWS[0], ROWS[1]]
  assert.deepEqual([...pickedKeySet(picked)].sort(), ['PO#1', 'PO#2'])
  assert.deepEqual(
    buildBatchSendLines(ROWS, picked, ALL_FILLED),
    buildBatchSendLines(ROWS, new Set(['PO#1', 'PO#2']), ALL_FILLED),
  )
})

test('默认勾选范围 = 还有剩余的行(已送满的不勾)', () => {
  assert.deepEqual(defaultPickKeys(ROWS), ['PO#1', 'PO#2'])
})

test('本次合计只算勾选行(否则合计与生单结果不一致)', () => {
  assert.equal(sumPickedQty(ROWS, ['PO#1'], ALL_FILLED), 10)
  assert.equal(sumPickedQty(ROWS, ['PO#1', 'PO#2'], ALL_FILLED), 30)
  assert.equal(sumPickedQty(ROWS, [], ALL_FILLED), 0)
})

test('数量为小数:合计按两位精度归整,payload 保留原值', () => {
  const rows = [{ lineKey: 'A', 剩余数量: 1.005 }, { lineKey: 'B', 剩余数量: 2.004 }]
  assert.equal(sumPickedQty(rows, ['A', 'B'], { A: 1.005, B: 2.004 }), 3.01)
  assert.deepEqual(buildBatchSendLines(rows, ['A'], { A: 1.005 }), [{ lineKey: 'A', qty: 1.005 }])
})
