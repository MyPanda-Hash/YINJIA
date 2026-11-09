import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickedKeySet, defaultPickKeys, buildBatchSendLines, sumPickedQty, overAllowance, floorTo,
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

test('小数精度:缺省两位向下取整(上限只能少不能多)', () => {
  // 100.005 × 5% = 5.00025 → 超送 5.00;105.005 → 上限 105.00(不是四舍五入的 105.01)
  assert.equal(overAllowance(100.005, 0, 0, 5), 105)
  assert.equal(overAllowance(10.5, 0, 0, 5, 1), 11)     // 10.5 × 5% = 0.525 → 0.5;上限 11.0
  assert.equal(overAllowance(10.5, 0, 0, 5, 0), 10)     // 0 位:0.525 → 0;上限 10
})

// ── 2026-11-09 用户口径「超送要去整;要根据单位确定超送是否需要小数,如果需要小数要确定位数」──
// 单位精度由服务端逐行下发(bs_uom.小数位数:个/卷/张=0、kg/米=3),前端按它算:
test('计件单位(个/卷,0 位):超送量取整 —— 24 个 ×20% 只能超送 4 个,不再是 4.7999…', () => {
  assert.equal(overAllowance(24, 24, 0, 20, 0), 4)      // 24×1.2=28.8 → 超送 4,上限 28
  assert.equal(overAllowance(24, 0, 0, 20, 0), 28)
  assert.equal(overAllowance(12, 12, 0, 20, 0), 2)      // 12×1.2=14.4 → 超送 2,上限 14
  assert.equal(overAllowance(5000, 5000, 0, 20, 0), 1000)
})

test('计量单位(kg/米,3 位):超送保留 3 位小数,不出现浮点尾数', () => {
  assert.equal(overAllowance(304.6, 304.6, 0, 20, 3), 60.92)
  assert.equal(overAllowance(24.5, 24.5, 0, 20, 3), 4.9)
  assert.equal(overAllowance(0.2, 0.2, 0, 20, 3), 0.04)
})

test('floorTo:按精度向下取整(1e-9 容差吃掉 4.7999…×100 的尾差)', () => {
  assert.equal(floorTo(4.799999999999997, 0), 4)
  assert.equal(floorTo(2.3999999999999986, 0), 2)
  assert.equal(floorTo(60.92000000000001, 3), 60.92)
  assert.equal(floorTo(-1.2, 0), -2)                    // 负数向下(不会出现:上限先 max 0)
})
