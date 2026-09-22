import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickedKeySet, defaultPickKeys, buildBatchSendLines, sumPickedQty, overAllowance,
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

/* ────────── 超送可送上限(2026-09-22 口径:按订单**全部数量**算,比例最高 50%) ──────────
 * 用户报的缺陷:「超送计算有问题,应该是按全部数量来计算的」——
 * 旧口径 剩余×(1+比例) 每批只给当批剩余的比例额,分批越多额度越少;正确语义:
 * 整张订单行累计最多收 订单数量×(1+比例),本次还能收 = 该额度 − 已送 + 已退回。
 */
test('未送:上限 = 订单数量×(1+比例)', () => {
  assert.equal(overAllowance(100, 0, 0, 5), 105)
  assert.equal(overAllowance(100, 0, 0, 0), 100)
})

test('已送满订单(剩余=0):仍可超送 订单数量×比例 —— 旧口径这里会算成 0', () => {
  assert.equal(overAllowance(100, 100, 0, 5), 5)
})

test('分批累计:额度随"总额度−已送"递减,送满总额度后归 0(不再每批重算比例额)', () => {
  assert.equal(overAllowance(100, 50, 0, 5), 55)   // 第一批送 50 后还能送 55(总 105)
  assert.equal(overAllowance(100, 105, 0, 5), 0)   // 累计到顶
  assert.equal(overAllowance(100, 103, 0, 5), 2)
})

test('退回回冲:已退回的部分腾出等量额度', () => {
  assert.equal(overAllowance(100, 60, 10, 5), 55)  // 105 − 60 + 10
})

test('比例钳制:超过 50% 按 50% 算(用户口径:超送最高 50%)', () => {
  assert.equal(overAllowance(100, 0, 0, 80), 150)
  assert.equal(overAllowance(100, 0, 0, 50), 150)
  assert.equal(overAllowance(100, 0, 0, -5), 100)  // 负数按 0
})

test('负额度归 0(已送超过总额度,如人工调过参数)', () => {
  assert.equal(overAllowance(100, 110, 0, 5), 0)
})

test('小数精度:按两位归整', () => {
  assert.equal(overAllowance(100.005, 0, 0, 5), 105.01)
})
