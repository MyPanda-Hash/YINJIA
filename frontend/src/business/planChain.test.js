/**
 * planChain.test.js — 工序排线「计划开工/完工日期」日期链(2026-10-30 起,2026-11-18 第二轮重定)
 *
 * 钉住现行口径(planChain.js 文件头 ① ② ③):
 *   · 预计开工:本道实际开工(已审报工最早时间) > 上一道实际开工 > 上一道计划完工(上游没开工时) > 今天;
 *   · 预计完工:**排产时原来选择的日期**,不顺延;只有开工晚于完工时才后延到开工日;
 *   · 实际完工日不再改写计划日期(第一轮那版已按用户复核否掉);
 *   · 跨道不再要求「后道开工 ≥ 上道计划完工」,只保留「本道开工 ≤ 本道完工」。
 *
 * 另外钉住编辑路径(改完工/改开工)的自动调平与提交前硬校验。
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

test('normalizePlanChain:上游都没报工 ⇒ 沿用计划链(第2道开工=上一道完工);完工保持原选择、倒挂才后延', () => {
  // 实测脏形态:成型 10-29~10-31、切炭 10-08~10-15、装箱 10-30~10-29(开工晚于完工)
  const rows = [
    row('成型', '2026-10-29', '2026-10-31'),
    row('切炭', '2026-10-08', '2026-10-15'),
    row('装箱', '2026-10-30', '2026-10-29'),
  ]
  normalizePlanChain(rows, '2026-11-01')
  assert.deepEqual(pair(rows), [
    ['2026-10-29', '2026-10-31'],
    ['2026-10-31', '2026-10-31'],   // 开工=上一道完工;原完工 10-15 已过去 ⇒ 后延到开工(不按原时长顺延)
    ['2026-10-31', '2026-10-31'],   // 开工=上一道完工;原完工 10-29 早于开工 ⇒ 后延
  ])
  // 首道缺开工给今天;没有报工的第二道沿用上一道完工
  const blank = [{ 工序: '成型' }, { 工序: '切炭' }]
  normalizePlanChain(blank, '2026-11-01')
  assert.deepEqual(pair(blank), [['2026-11-01', '2026-11-01'], ['2026-11-01', '2026-11-01']])
})

test('normalizePlanChain:按实际开工(最早报工)推导下道开工,预计完工保持排产时选的日期(2026-11-18 第二轮)', () => {
  // 截图形态:成型 计划 11-18~11-20、实际开工 11-18 11:49;切炭 11-20~11-23;组装 11-23~11-24
  const rows = [
    { ...row('成型', '2026-11-18', '2026-11-20'), 实际开工: '2026-11-18 11:49', 实际完工: '2026-11-18 11:49' },
    row('切炭', '2026-11-20', '2026-11-23'),
    row('组装', '2026-11-23', '2026-11-24'),
  ]
  normalizePlanChain(rows, '2026-11-18')
  assert.deepEqual(pair(rows), [
    ['2026-11-18', '2026-11-20'],   // 已完工也不用实际完工改写计划完工(用户复核口径)
    ['2026-11-18', '2026-11-23'],   // 开工=上一道实际开工日;完工=原来选择的 11-23
    ['2026-11-23', '2026-11-24'],   // 切炭还没报工 ⇒ 组装仍按计划链(上一道预计完工 11-23)
  ])
})

test('normalizePlanChain:本道有报工取本道实际开工日;没有报工才取上一道完工日', () => {
  const rows = [
    { ...row('成型', '2026-11-18', '2026-11-20'), 实际开工: '2026-11-18 11:49' },
    { ...row('切炭', '2026-11-20', '2026-11-23'), 实际开工: '2026-11-19 08:10' },   // 本道已开工
    row('组装', '2026-11-23', '2026-11-24'),
  ]
  normalizePlanChain(rows, '2026-11-18')
  assert.deepEqual(pair(rows), [
    ['2026-11-18', '2026-11-20'],
    ['2026-11-19', '2026-11-23'],   // 本道实际开工 11-19 优先于上一道完工/在开工
    ['2026-11-19', '2026-11-24'],   // 上一道实际开工 11-19 ⇒ 本道开工 11-19;完工保持 11-24
  ])
})

test('normalizePlanChain:实际开工带时分只取日期;任何一列都不留时分', () => {
  const rows = [
    { ...row('成型', '2026-11-18', '2026-11-20'), 实际开工: '2026-11-18 11:49:02' },
    { ...row('切炭', '2026-11-20', '2026-11-23'), 实际开工: '2026-11-19 08:05:33' },
  ]
  normalizePlanChain(rows, '2026-11-18')
  for (const r of rows) {
    assert.match(r['计划开工日期'], /^\d{4}-\d{2}-\d{2}$/)
    assert.match(r['计划完工日期'], /^\d{4}-\d{2}-\d{2}$/)
  }
  assert.equal(rows[1]['计划开工日期'], '2026-11-19')
})

test('cascadeDue:改完工 ⇒ 未开工下游开工跟到本道完工,下游完工保持原日期(不顺延)', () => {
  const rows = [
    row('成型', '2026-11-01', '2026-11-02'),
    row('切炭', '2026-11-02', '2026-11-05'),
    row('组装', '2026-11-05', '2026-11-06'),
  ]
  const fixed = cascadeDue(rows, 0, '2026-11-03')
  assert.deepEqual(fixed, { start: null, due: null })
  assert.deepEqual(pair(rows), [
    ['2026-11-01', '2026-11-02'],   // 本道日期由 v-model 写入(这里调用方只传值,本函数不管本道完工)
    ['2026-11-03', '2026-11-05'],   // 下游开工跟到 11-03,完工仍保持原来的 11-05(不再 +时长)
    ['2026-11-05', '2026-11-06'],   // 再下游同理
  ])
})

test('cascadeDue:已开工(实际开工有值)的下游不动 —— 日期以实际报工为准', () => {
  const rows = [
    row('成型', '2026-11-01', '2026-11-02'),
    { ...row('切炭', '2026-11-02', '2026-11-05'), 实际开工: '2026-11-02 09:00' },
    row('组装', '2026-11-05', '2026-11-06'),
  ]
  cascadeDue(rows, 0, '2026-11-04')
  assert.deepEqual(pair(rows)[1], ['2026-11-02', '2026-11-05'])   // 已开工 ⇒ 不被上游完工推着走
})

test('cascadeDue:改完工日早于本道开工 ⇒ 本道开工降到完工日(2026-11-09 报障:开工 11-09 / 完工 11-03)', () => {
  const rows = [
    row('成型', '2026-11-09', '2026-11-09'),
    row('切炭', '2026-11-03', '2026-11-03'),
  ]
  rows[0]['计划完工日期'] = '2026-11-03'
  const fixed = cascadeDue(rows, 0, '2026-11-03')
  assert.deepEqual(fixed, { start: '2026-11-03', due: null })
  assert.deepEqual(pair(rows)[0], ['2026-11-03', '2026-11-03'])
  assert.equal(invertedPlanRows(rows).length, 0)
})

test('cascadeStart:开工晚于本道完工 ⇒ 完工拉到开工,并只推动未开工的下游', () => {
  const rows = [
    row('成型', '2026-11-01', '2026-11-02'),
    row('切炭', '2026-11-02', '2026-11-04'),
    row('组装', '2026-11-04', '2026-11-04'),
  ]
  assert.deepEqual(cascadeStart(rows, 1, '2026-11-06'), { start: null, due: '2026-11-06' })
  assert.equal(rows[1]['计划完工日期'], '2026-11-06')
  assert.equal(rows[2]['计划开工日期'], '2026-11-06')
  assert.equal(rows[2]['计划完工日期'], '2026-11-06')   // 原完工 11-04 早于新开工 ⇒ 后延
  // 开工不晚于完工 ⇒ 什么都不动
  const before = JSON.stringify(rows)
  assert.deepEqual(cascadeStart(rows, 0, '2026-11-01'), { start: null, due: null })
  assert.equal(JSON.stringify(rows), before)
})

test('cascadeStart:不再按「上道计划完工」夹本道开工(后道提前开工是允许的)', () => {
  const rows = [
    row('成型', '2026-11-11', '2026-11-13'),
    row('切炭', '2026-11-11', '2026-11-11'),
  ]
  rows[1]['计划开工日期'] = '2026-11-01'   // v-model 已写入(真实组件顺序)
  assert.deepEqual(cascadeStart(rows, 1, '2026-11-01'), { start: null, due: null })
  assert.equal(rows[1]['计划开工日期'], '2026-11-01')   // 原样保留,不夹到上道完工
})

test('planDateProblems:只报本道倒挂;后道开工早于上道完工不再算错(2026-11-18 第二轮)', () => {
  assert.deepEqual(planDateProblems([]), [])
  // 后道开工 11-01 早于上道计划完工 11-13 —— 新口径下合法(上道提前开工、量已流入)
  assert.deepEqual(planDateProblems([
    row('成型', '2026-11-11', '2026-11-13'),
    row('切炭', '2026-11-01', '2026-11-20'),
  ]), [])
  // 本道倒挂要报
  const mixed = [row('成型', '2026-11-13', '2026-11-11')]
  assert.deepEqual(planDateProblems(mixed).map((p) => [p.index, p.kind]), [[0, 'inverted']])
})

test('isPlanDateInverted / invertedPlanRows:开工>完工 才算倒挂;空值/相等/带时间都不误报', () => {
  assert.equal(isPlanDateInverted(row('成型', '2026-11-09', '2026-11-03')), true)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-03', '2026-11-03')), false)
  assert.equal(isPlanDateInverted(row('成型', '', '2026-11-03')), false)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-09', '')), false)
  assert.equal(isPlanDateInverted(null), false)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-03T00:00:00', '2026-11-03T00:00:00')), false)
  assert.equal(isPlanDateInverted(row('成型', '2026-11-09T08:00:00', '2026-11-03T00:00:00')), true)
  const bad = invertedPlanRows([
    row('成型', '2026-11-09', '2026-11-03'),
    row('切炭', '2026-11-01', '2026-11-02'),
  ])
  assert.equal(bad.length, 1)
  assert.equal(bad[0].index, 0)
})
