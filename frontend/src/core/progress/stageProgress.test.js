import test from 'node:test'
import assert from 'node:assert/strict'
import { pickStages, stageRowState, statusLabel, summarizeStages } from './stageProgress.js'

const TODAY = '2026-09-15'

function planWith(stages) {
  const head = { 项目名称: '除重金属炭棒滤芯降本开发', 单据编号: 'LXB-2026-09-0001' }
  for (const s of stages) {
    const n = s.no
    if (s.name !== undefined) head[`阶段${n}`] = s.name
    if (s.content !== undefined) head[`阶段${n}_计划内容`] = s.content
    if (s.start !== undefined) head[`阶段${n}_计划开始`] = s.start
    if (s.due !== undefined) head[`阶段${n}_计划完成`] = s.due
    if (s.actual !== undefined) head[`阶段${n}_实际完成`] = s.actual
    if (s.owner !== undefined) head[`阶段${n}_责任人`] = s.owner
  }
  return head
}

test('pickStages extracts filled stages in order', () => {
  const head = planWith([
    { no: 1, name: '立项与方案评审', content: '立项与方案评审', start: '2026-09-10', due: '2026-09-10', actual: '2026-09-10', owner: '陈研发' },
    { no: 2, content: '样品打样与小批量试制', due: '2026-09-25', owner: '陈研发' },
  ])
  const stages = pickStages(head)
  assert.equal(stages.length, 2)
  assert.deepEqual(stages[0], { no: 1, content: '立项与方案评审', start: '2026-09-10', due: '2026-09-10', actual: '2026-09-10', owner: '陈研发' })
  assert.equal(stages[1].content, '样品打样与小批量试制')
})

test('pickStages skips stages without any content', () => {
  const head = planWith([
    { no: 1, content: '立项与方案评审' },
    { no: 2 },
    { no: 3, due: '2026-09-30' },
  ])
  const stages = pickStages(head)
  assert.deepEqual(stages.map((s) => s.no), [1])
})

test('pickStages falls back to the legacy 阶段N field when 计划内容 is empty', () => {
  const head = planWith([{ no: 1, name: '老版阶段标题' }, { no: 2, content: '新版计划内容' }])
  const stages = pickStages(head)
  assert.deepEqual(stages.map((s) => s.content), ['老版阶段标题', '新版计划内容'])
})

test('pickStages returns an empty list for a plan without stages', () => {
  assert.deepEqual(pickStages({ 项目名称: 'X', 阶段1_计划内容: '', 阶段2: '  ' }), [])
})

test('summarizeStages counts finished and unfinished stages', () => {
  const head = planWith([
    { no: 1, content: 'A', actual: '2026-09-10' },
    { no: 2, content: 'B', actual: '2026-09-12' },
    { no: 3, content: 'C', due: '2026-09-30' },
  ])
  const s = summarizeStages(pickStages(head), TODAY)
  assert.equal(s.total, 3)
  assert.equal(s.done, 2)
  assert.equal(s.state, 'doing')
  assert.equal(s.next.no, 3)
})

test('summarizeStages marks unfinished stages past their due date as overdue', () => {
  const head = planWith([
    { no: 1, content: 'A', actual: '2026-09-10' },
    { no: 2, content: 'B', due: '2026-09-12' },
    { no: 3, content: 'C', due: '2026-09-20' },
  ])
  const s = summarizeStages(pickStages(head), TODAY)
  assert.equal(s.overdue, 1)
  assert.equal(s.state, 'doing')
})

test('a stage finishing on the due date is not overdue', () => {
  const head = planWith([{ no: 1, content: 'A', due: '2026-09-15' }])
  assert.equal(summarizeStages(pickStages(head), TODAY).overdue, 0)
})

test('slash dates are compared like dash dates', () => {
  const head = planWith([{ no: 1, content: 'A', due: '2026/9/12' }])
  assert.equal(summarizeStages(pickStages(head), TODAY).overdue, 1)
})

test('all stages finished reports the done state', () => {
  const head = planWith([{ no: 1, content: 'A', actual: '2026-09-10' }, { no: 2, content: 'B', actual: '2026-09-11' }])
  assert.equal(summarizeStages(pickStages(head), TODAY).state, 'done')
})

test('a plan with no filled stage reports none', () => {
  assert.equal(summarizeStages([], TODAY).state, 'none')
})

test('a missing plan reports no_plan', () => {
  assert.equal(summarizeStages(null, TODAY).state, 'no_plan')
})

test('statusLabel renders every state', () => {
  assert.equal(statusLabel({ state: 'no_plan' }), '无实施计划')
  assert.equal(statusLabel({ state: 'none' }), '无阶段计划')
  assert.equal(statusLabel({ state: 'not_started', total: 5, done: 0, overdue: 0 }), '未开始 0/5')
  assert.equal(statusLabel({ state: 'doing', total: 5, done: 2, overdue: 0 }), '进行中 2/5')
  assert.equal(statusLabel({ state: 'doing', total: 5, done: 2, overdue: 1 }), '进行中 2/5 · 逾期 1')
  assert.equal(statusLabel({ state: 'done', total: 5, done: 5, overdue: 0 }), '全部完成 5/5')
})

test('no finished stage yet reports not_started', () => {
  const head = planWith([{ no: 1, content: 'A', due: '2026-09-30' }])
  const s = summarizeStages(pickStages(head), TODAY)
  assert.equal(s.state, 'not_started')
  assert.equal(s.next.no, 1)
})

test('the next stage is the first unfinished one', () => {
  const head = planWith([
    { no: 1, content: 'A', actual: '2026-09-10' },
    { no: 2, content: 'B' },
    { no: 3, content: 'C' },
  ])
  assert.equal(summarizeStages(pickStages(head), TODAY).next.content, 'B')
})

test('each stage row gets its own badge state', () => {
  const head = planWith([
    { no: 1, content: 'A', actual: '2026-09-10' },
    { no: 2, content: 'B', due: '2026-09-12' },
    { no: 3, content: 'C', due: '2026-09-30' },
  ])
  assert.deepEqual(pickStages(head).map((s) => stageRowState(s, TODAY)), ['done', 'overdue', 'doing'])
})
