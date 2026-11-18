/**
 * planChain.test.js — 工序排线「计划开工/完工日期」日期链(2026-10-30)
 *
 * 钉住用户口径「上一道的计划完工日期 = 下一道的计划开工日期」,
 * 以及从单行排线弹窗原样抽出的三条边界(行为必须与抽取前一致):
 *   · 打开规整:第 2 道起开工=上一道完工、保留原计划时长;首道缺开工给今天;完工<开工拉平;
 *   · 改完工:下一道开工=本道完工,后续按原时长顺延;
 *   · 改开工:开工晚于本道完工 ⇒ 完工拉到开工并继续下传。
 *
 * 2026-11-09 增补(用户报障「计划开工日期可以大于计划完工日期」):
 *   · 改完工日若早于**本道**开工日 ⇒ 本道开工一起降到完工日(否则留下 11-09~11-03 的倒挂);
 *   · isPlanDateInverted / invertedPlanRows:供弹窗提交前硬校验。
 *
 * 2026-11-11 增补(用户口径「下方的工序页不能比上方的工序小」):
 *   · 后道开工/完工不得早于**上道完工**:改日期时先夹到上道完工日,再管本道开工≤完工;
 *   · planDateProblems 同时报「本道倒挂」和「下道早于上道」两类,供提交前一次拦全。
 *
 * 2026-11-18 增补(用户口径 + 「工序路线排线」截图,实际完工优先):
 *   · 某道已实际完工 ⇒ 该道计划完工日 = **实际完工日**(只取前 10 位);
 *   · 下一道开工 = 上一道(**实际完工日** || 计划完工日),下一道完工 = 开工 + 本道**原**计划时长;
 *   · 没有实际完工的行行为必须与 2026-11-11 那版逐字一致。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays, daysBetween, cascadeDue, cascadeStart, normalizePlanChain,
  isPlanDateInverted, invertedPlanRows, planDateProblems,
} from './planChain.js'

const row = (op, start, due) => ({ 工序: op, 计划开工日期: start, 计划完工日期: due })
const pair = (rows) => rows.map((r) => [r['计划开工日期'], r['计划完工日期']])

test('addDays/daysBetween:跨月正确;非法输入不炸', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-11-01', -1), '2026-10-31')
  assert.equal(addDays('bad', 1), 'bad')
  assert.equal(daysBetween('2026-10-29', '2026-11-01'), 3)
  assert.equal(daysBetween('2026-11-01', '2026-10-29'), -3)
  assert.equal(daysBetween(null, '2026-11-01'), 0)
})

test('normalizePlanChain:第 2 道起开工=上一道完工,保留该道原时长;首道缺开工用今天', () => {
  // 实测脏形态:成型 10-29~10-31、切炭 10-08~10-15、装箱 10-30~10-29(开工晚于完工)
  const rows = [
    row('成型', '2026-10-29', '2026-10-31'),
    row('切炭', '2026-10-08', '2026-10-15'),   // 原时长 7 天
    row('装箱', '2026-10-30', '2026-10-29'),
  ]
  normalizePlanChain(rows, '2026-11-01')
  assert.deepEqual(rows.map((r) => [r['计划开工日期'], r['计划完工日期']]), [
    ['2026-10-29', '2026-10-31'],
    ['2026-10-31', '2026-11-07'],   // 开工=上一道完工,原 7 天整体顺延
    ['2026-11-07', '2026-11-07'],   // 原时长 0/负数 ⇒ 拉平
  ])
  const blank = [{ 工序: '成型' }, { 工序: '切炭' }]
  normalizePlanChain(blank, '2026-11-01')
  assert.equal(blank[0]['计划开工日期'], '2026-11-01')
  assert.equal(blank[0]['计划完工日期'], '2026-11-01')
  assert.equal(blank[1]['计划开工日期'], '2026-11-01')
})

test('cascadeDue:改完工日 ⇒ 下一道开工=本道完工,后续按各自原时长顺延', () => {
  const rows = [
    row('成型', '2026-11-01', '2026-11-02'),
    row('切炭', '2026-11-02', '2026-11-05'),   // 时长 3 天
    row('组装', '2026-11-05', '2026-11-06'),   // 时长 1 天
  ]
  const fixed = cascadeDue(rows, 0, '2026-11-03')
  assert.deepEqual(fixed, { start: null, due: null })     // 首道没有上道 ⇒ 完工不被夹;本道也没倒挂 ⇒ 不提示
  assert.deepEqual(pair(rows), [
    ['2026-11-01', '2026-11-02'],   // 本道日期没倒挂(11-01 ≤ 11-03)⇒ 本道原样不动、只由调用方 v-model 写入完工值
    ['2026-11-03', '2026-11-06'],
    ['2026-11-06', '2026-11-07'],
  ])
})

test('cascadeDue:改完工日早于本道开工 ⇒ 本道开工降到完工日(2026-11-09 报障截图:开工 11-09 / 完工 11-03)', () => {
  // 实测形态:首道计划开工默认今天(11-09),完工日被改成交期 11-03;后面的道已按 11-03 排
  const rows = [
    row('成型', '2026-11-09', '2026-11-09'),
    row('切炭', '2026-11-03', '2026-11-03'),
    row('装箱', '2026-11-03', '2026-11-03'),
  ]
  // @change 触发前 v-model 已把完工写成 11-03(真实组件的顺序),此时本道开工还留着 11-09
  rows[0]['计划完工日期'] = '2026-11-03'
  const fixed = cascadeDue(rows, 0, '2026-11-03')
  assert.deepEqual(fixed, { start: '2026-11-03', due: null })   // 返回被调平的开工日,调用方据此提示
  assert.deepEqual(pair(rows), [
    ['2026-11-03', '2026-11-03'],
    ['2026-11-03', '2026-11-03'],
    ['2026-11-03', '2026-11-03'],
  ])
  assert.equal(invertedPlanRows(rows).length, 0)
})

test('cascadeStart:开工晚于本道完工 ⇒ 完工拉到开工并向后续传,并返回顺延后的完工日', () => {
  const rows = [
    row('成型', '2026-11-01', '2026-11-02'),
    row('切炭', '2026-11-02', '2026-11-04'),
    row('组装', '2026-11-04', '2026-11-04'),
  ]
  assert.deepEqual(cascadeStart(rows, 1, '2026-11-06'), { start: null, due: '2026-11-06' })
  assert.equal(rows[1]['计划完工日期'], '2026-11-06')
  assert.equal(rows[2]['计划开工日期'], '2026-11-06')
  assert.equal(rows[2]['计划完工日期'], '2026-11-06')   // 原时长 0
  // 开工没晚于完工 ⇒ 什么都不动(也不返回提示值)
  const before = JSON.stringify(rows)
  assert.deepEqual(cascadeStart(rows, 0, '2026-11-01'), { start: null, due: null })
  assert.equal(JSON.stringify(rows), before)
})

test('cascadeStart:下方工序开工早于上方完工 ⇒ 夹到上方完工日(2026-11-11 报障截图:成型 11-11~11-13、切炭 11-01)', () => {
  // 截图形态:第 1 道 11-11~11-13,后两道却都是 11-01~11-01(手工把下道开工改早了)
  const rows = [
    row('成型', '2026-11-11', '2026-11-13'),
    row('切炭', '2026-11-11', '2026-11-11'),
    row('组装', '2026-11-11', '2026-11-11'),
  ]
  rows[1]['计划开工日期'] = '2026-11-01'
  const fixed = cascadeStart(rows, 1, '2026-11-01')
  assert.deepEqual(fixed, { start: '2026-11-13', due: '2026-11-13' })  // 开工被上道完工夹到 11-13;完工随之顺延
  assert.deepEqual(pair(rows), [
    ['2026-11-11', '2026-11-13'],
    ['2026-11-13', '2026-11-13'],
    ['2026-11-13', '2026-11-13'],
  ])
  assert.deepEqual(planDateProblems(rows), [])
})

test('cascadeDue:下方工序完工早于上方完工 ⇒ 夹到上方完工日,再顺延下游', () => {
  const rows = [
    row('成型', '2026-11-11', '2026-11-13'),
    row('切炭', '2026-11-13', '2026-11-15'),
    row('组装', '2026-11-15', '2026-11-16'),
  ]
  rows[1]['计划完工日期'] = '2026-11-01'
  const fixed = cascadeDue(rows, 1, '2026-11-01')
  assert.deepEqual(fixed, { start: null, due: '2026-11-13' })
  assert.equal(rows[1]['计划完工日期'], '2026-11-13')   // 夹到上道完工日(开工 11-13 未超完工 ⇒ 不动)
  assert.equal(rows[2]['计划开工日期'], '2026-11-13')   // 下游跟着上道完工
  assert.deepEqual(planDateProblems(rows), [])
})

test('planDateProblems:两类问题一次列全(本道倒挂 + 下道早于上道)', () => {
  assert.deepEqual(planDateProblems([]), [])
  // 截图形态:本道没倒挂,但下道早于上道
  const shot = [
    row('成型', '2026-11-11', '2026-11-13'),
    row('切炭', '2026-11-01', '2026-11-01'),
    row('组装', '2026-11-01', '2026-11-01'),
  ]
  const probs = planDateProblems(shot)
  assert.deepEqual(probs.map((p) => [p.index, p.kind, p.prevDue]), [
    [1, 'order', '2026-11-13'],   // 切炭 11-01 < 成型完工 11-13;组装 11-01 与切炭完工相等 ⇒ 不算早,不报
  ])
  assert.equal(probs[0].row['工序'], '切炭')
  assert.equal(probs[0].prevRow['工序'], '成型')
  // 本道倒挂也一起报(两道都不合规)
  const mixed = [
    row('成型', '2026-11-13', '2026-11-11'),   // 本道倒挂
    row('切炭', '2026-11-01', '2026-11-02'),   // 早于上道完工 11-11
  ]
  assert.deepEqual(planDateProblems(mixed).map((p) => p.kind), ['inverted', 'order'])
  // 合法链(相邻相等/留空)不误报
  assert.deepEqual(planDateProblems([
    row('成型', '2026-11-11', '2026-11-13'),
    row('切炭', '2026-11-13', '2026-11-13'),
    row('组装', '2026-11-14', '2026-11-15'),
  ]), [])
})

test('isPlanDateInverted / invertedPlanRows:开工>完工 才算倒挂;空值/相等/带时间都不误报', () => {
  assert.equal(isPlanDateInverted(row('成型', '2026-11-09', '2026-11-03')), true)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-03', '2026-11-03')), false)
  assert.equal(isPlanDateInverted(row('成型', '', '2026-11-03')), false)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-09', '')), false)
  assert.equal(isPlanDateInverted(null), false)
  // 库里给的是 datetime 串时按日期部分比较
  assert.equal(isPlanDateInverted(row('成型', '2026-11-03T00:00:00', '2026-11-03T00:00:00')), false)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-09T08:00:00', '2026-11-03T00:00:00')), true)
  const bad = invertedPlanRows([
    row('成型', '2026-11-09', '2026-11-03'),
    row('切炭', '2026-11-01', '2026-11-02'),
  ])
  assert.equal(bad.length, 1)
  assert.equal(bad[0].index, 0)
  assert.equal(bad[0].row['工序'], '成型')
})

test('normalizePlanChain:首道已实际完工 ⇒ 首道计划完工=实际完工日,第二道开工取实际完工日、完工按本道原时长顺延(2026-11-18 截图)', () => {
  // 截图形态:成型 计划 11-18~11-20,实际完工 11-18 11:49;切炭原计划 11-20~11-23(时长 3 天)
  const rows = [
    { ...row('成型', '2026-11-18', '2026-11-20'), 实际完工: '2026-11-18 11:49' },  // 原时长 2 天
    row('切炭', '2026-11-20', '2026-11-23'),                                       // 原时长 3 天
  ]
  normalizePlanChain(rows, '2026-11-18')
  assert.deepEqual(pair(rows), [
    ['2026-11-18', '2026-11-18'],   // 已完工那道自己的计划完工也踩实际完工日(链一致 + 后端校验 + 回填台账)
    ['2026-11-18', '2026-11-21'],   // 开工=上道**实际**完工日;完工=开工+本道原时长 3 天(不是 11-18)
  ])
  // preplanManual 的「下道开工不得早于上道完工」从现在起的台账值上过得去
  assert.deepEqual(planDateProblems(rows), [])
})

test('normalizePlanChain:没有实际完工的行行为不变(逐字沿用 2026-11-11 口径)', () => {
  const rows = [
    row('成型', '2026-11-18', '2026-11-19'),
    row('切炭', '2026-11-19', '2026-11-22'),   // 原时长 3 天
    row('组装', '2026-11-22', '2026-11-25'),   // 原时长 3 天
  ]
  normalizePlanChain(rows, '2026-11-18')
  assert.deepEqual(pair(rows), [
    ['2026-11-18', '2026-11-19'],
    ['2026-11-19', '2026-11-22'],
    ['2026-11-22', '2026-11-25'],
  ])
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], '实际完工'), false)   // 不凭空新增字段
  // 实际完工为空串 / 首道缺开工:仍走原口径(首道今天,后续=上一道计划完工)
  const blank = [{ 工序: '成型' }, { 工序: '切炭', 实际完工: '' }]
  normalizePlanChain(blank, '2026-11-18')
  assert.deepEqual(pair(blank), [['2026-11-18', '2026-11-18'], ['2026-11-18', '2026-11-18']])
})

test('normalizePlanChain:实际完工带时分只取日期;实际完工早于排出的开工日则开工让到实际完工日', () => {
  const rows = [
    row('成型', '2026-11-17', '2026-11-18'),
    { ...row('切炭', '2026-11-18', '2026-11-20'), 实际完工: '2026-11-19 08:05' },  // 原时长 2 天
    row('组装', '2026-11-20', '2026-11-21'),                                       // 原时长 1 天
  ]
  normalizePlanChain(rows, '2026-11-18')
  assert.deepEqual(pair(rows), [
    ['2026-11-17', '2026-11-18'],
    ['2026-11-18', '2026-11-19'],   // 带时分的实际完工只取 `2026-11-19`
    ['2026-11-19', '2026-11-20'],   // 下道开工=上道**实际**完工日,完工=开工+原时长 1 天
  ])
  // 任何一列都不许留下时分(后端按 datetime 比较/回填台账会错位)
  for (const r of rows) {
    assert.match(r['计划开工日期'], /^\d{4}-\d{2}-\d{2}$/)
    assert.match(r['计划完工日期'], /^\d{4}-\d{2}-\d{2}$/)
  }
  // 实际完工早于「按上道计划完工排出来的开工日」⇒ 开工让到实际完工日,本行不倒挂;
  // 但本行开工就早于上道完工了 ⇒ planDateProblems 仍会报 order(弹窗提交前点名,用户手改)
  const early = [
    row('成型', '2026-11-10', '2026-11-16'),
    { ...row('切炭', '2026-11-16', '2026-11-20'), 实际完工: '2026-11-15 09:30' },
  ]
  normalizePlanChain(early, '2026-11-18')
  assert.deepEqual(pair(early), [
    ['2026-11-10', '2026-11-16'],
    ['2026-11-15', '2026-11-15'],   // 开工退到实际完工日(不倒挂)
  ])
  assert.deepEqual(invertedPlanRows(early), [])
  assert.deepEqual(planDateProblems(early).map((p) => p.kind), ['order'])
})
