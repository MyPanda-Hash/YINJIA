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
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays, daysBetween, cascadeDue, cascadeStart, normalizePlanChain,
  isPlanDateInverted, invertedPlanRows,
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
  cascadeDue(rows, 0, '2026-11-03')
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
  const fixedStart = cascadeDue(rows, 0, '2026-11-03')
  assert.equal(fixedStart, '2026-11-03')                 // 返回被调平的开工日,调用方据此提示
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
  assert.equal(cascadeStart(rows, 1, '2026-11-06'), '2026-11-06')
  assert.equal(rows[1]['计划完工日期'], '2026-11-06')
  assert.equal(rows[2]['计划开工日期'], '2026-11-06')
  assert.equal(rows[2]['计划完工日期'], '2026-11-06')   // 原时长 0
  // 开工没晚于完工 ⇒ 什么都不动(也不返回提示值)
  const before = JSON.stringify(rows)
  assert.equal(cascadeStart(rows, 0, '2026-11-01'), null)
  assert.equal(JSON.stringify(rows), before)
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
