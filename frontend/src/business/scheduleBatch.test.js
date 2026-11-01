/**
 * scheduleBatch.test.js — 生产工单「批量排产」纯逻辑(2026-10-30)
 *
 * 钉住用户口径的边界:
 *   · 工序链相同才能同批;不同工序/未绑路线的行必须被点名排除,不能混进同一批共用产线;
 *   · 排产数量按**各行各行**算(默认=当前排产数量>0 否则需求),超需求/0 被前置拦下;
 *   · 计划量 = 本行排产数量 × 本行该道换算率(各道分开算、不累乘);
 *   · 同链不同率时,每道合计按各行自己的率算(切炭 400+300=700,不是 300×2=600)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chainOf,
  rateChainOf,
  groupByChain,
  splitBatch,
  rowKeyOf,
  defaultQty,
  planQtyOf,
  planChainOf,
  stepTotal,
  ratesOf,
  validateQty,
  rateDiffFromFirst,
} from './scheduleBatch.js'

const steps = (ops, rates) => ops.map((op, i) => ({ 工序: op, 换算率: rates ? rates[i] : 1 }))
const row = (no, xc, ops, rates, demand = 100, sched = 0) => ({
  加工单号: no,
  工单行号: xc,
  需求数量: demand,
  排产数量: sched,
  工序步骤: steps(ops, rates),
})

// 同工序链(成型>切炭>组装),但切炭换算率一个 2、一个 3 —— 用户举例的场景
const A = row('GD-A', 1, ['成型', '切炭', '组装'], [1, 2, 1], 200, 200)
const B = row('GD-B', 1, ['成型', '切炭', '组装'], [1, 3, 1], 100, 100)
// 不同工序链
const C = row('GD-C', 1, ['成型', '装箱'], [1, 1], 50, 50)
// 未绑路线(无工序步骤)
const D = row('GD-D', 2, [], [], 10, 10)
// 已经排过产(当前排产数量 > 需求以外的情况由 defaultQty 覆盖)
const E = row('GD-E', 1, ['成型', '切炭', '组装'], [1, 1, 1], 80, 60)

test('chainOf:按顺序拼工序名称并 trim;无工序/空步骤 ⇒ 空串', () => {
  assert.equal(chainOf(steps(['成型', ' 切炭 ', '组装'])), '成型>切炭>组装')
  assert.equal(chainOf([]), '')
  assert.equal(chainOf(null), '')
  assert.equal(chainOf([{ 工序: ' ' }]), '')
})

test('rateChainOf:与工序步骤同序,空/0 率按 1 兜底', () => {
  assert.deepEqual(rateChainOf(A), [1, 2, 1])
  assert.deepEqual(rateChainOf({ 工序步骤: [{ 工序: '成型', 换算率: 0 }, { 工序: '切炭' }] }), [1, 1])
})

test('groupByChain:同链一组、不同链分组、无路线单列;组按行数降序', () => {
  const { groups, singles } = groupByChain([A, B, C, D])
  assert.equal(singles.length, 1)
  assert.equal(singles[0].reason, 'noroute')
  assert.equal(singles[0].row, D)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].chain, '成型>切炭>组装')
  assert.equal(groups[0].count, 2)
  assert.equal(groups[1].chain, '成型>装箱')
  assert.equal(groups[1].count, 1)
})

test('splitBatch:默认取最大组,其余行带原因排除(chain/noroute)', () => {
  const { included, excluded, chosen } = splitBatch([A, B, C, D])
  assert.equal(chosen.chain, '成型>切炭>组装')
  assert.deepEqual(included, [A, B])
  const reasons = excluded.map((x) => `${rowKeyOf(x.row)}:${x.reason}`)
  assert.ok(reasons.includes('GD-C#1:chain'))
  assert.ok(reasons.includes('GD-D#2:noroute'))
  const c = excluded.find((x) => x.row === C)
  assert.equal(c.chain, '成型>装箱') // 界面点名时要能说出"它是什么工序"
})

test('splitBatch:指定另一组时以指定组为准;指定不存在的链 ⇒ 回落最大组', () => {
  const pickC = splitBatch([A, B, C], '成型>装箱')
  assert.deepEqual(pickC.included, [C])
  assert.ok(pickC.excluded.some((x) => x.row === A))
  const fallback = splitBatch([A, B, C], '不存在的链')
  assert.deepEqual(fallback.included, [A, B])
})

test('defaultQty:优先当前排产数量(>0),为 0 时取需求数量', () => {
  assert.equal(defaultQty(A), 200)
  assert.equal(defaultQty(E), 60)
  assert.equal(defaultQty({ 排产数量: 0, 需求数量: 120 }), 120)
  assert.equal(defaultQty({}), 0)
})

test('planQtyOf/planChainOf:计划量 = 本行数量 × 该道换算率,各道分开算不累乘', () => {
  assert.deepEqual(planChainOf(A), [200, 400, 200])
  assert.deepEqual(planChainOf(B), [100, 300, 100])
  assert.equal(planQtyOf(A, 1), 400)
  // 不累乘:切炭不会变成 200 × 1 × 2 = 400 之后再乘组装
  assert.equal(planQtyOf(A, 2), 200)
})

test('stepTotal:同链不同率时按各行自己的率合计(400+300=700,不是 300×2)', () => {
  assert.equal(stepTotal([A, B], 1), 700)
  assert.equal(stepTotal([A, B], 0), 300)
  assert.equal(stepTotal([A, B], 2), 300)
})

test('ratesOf:率一致 ⇒ null;不一致 ⇒ 去重升序(界面标"各行不同")', () => {
  assert.equal(ratesOf([A, B], 0), null)
  assert.deepEqual(ratesOf([A, B], 1), [2, 3])
  assert.equal(ratesOf([A, B], 2), null)
  assert.equal(ratesOf([A], 0), null)
})

test('rateDiffFromFirst:同链不同率的行要能标出来;首行自己不算差异', () => {
  assert.equal(rateDiffFromFirst([A, B], A), false)
  assert.equal(rateDiffFromFirst([A, B], B), true)
  assert.equal(rateDiffFromFirst([A, C], C), true) // 链不同也必然率链不同
})

test('validateQty:0/负数与超需求都被挑出,正常行不误报', () => {
  const bad0 = validateQty([{ 加工单号: 'X', 需求数量: 100, 排产数量: 0 }])
  assert.equal(bad0.length, 1)
  assert.equal(bad0[0].reason, 'qty')
  const badOver = validateQty([{ 加工单号: 'X', 需求数量: 100, 排产数量: 101 }])
  assert.equal(badOver[0].reason, 'over')
  assert.equal(validateQty([{ 加工单号: 'X', 需求数量: 100, 排产数量: 100 }]).length, 0)
  // 需求为 0/空时不判超需求(与后端 `demand > 0` 才校验同口径)
  assert.equal(validateQty([{ 需求数量: 0, 排产数量: 50 }]).length, 0)
})

test('rowKeyOf:统一用「工单号#行号」做提示标识', () => {
  assert.equal(rowKeyOf(A), 'GD-A#1')
  assert.equal(rowKeyOf({ 加工单号: 'GD-A' }), 'GD-A')
})
