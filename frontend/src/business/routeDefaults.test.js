/**
 * routeDefaults.test.js — 「上次」预填纯逻辑单测(2026-10-25 条39/条7)
 *
 * 每条断言都指向定稿方案的拍板语义,改坏必红:
 *   · pickRouteDefault    → 优先级 同物料上次(∈bs_route 候选)> 同品名同规格族(∈候选)> 绑定 > 空
 *                           (2026-10-29 增族兜底:同物料无历史/路线已删时借同品名同规格的兄弟编码)
 *   · applyRouteDefaults  → **计算 default 后整行写入**(冷读#1 拍板,不是仅补空);
 *                           路线审核状态仅 source='last'/'spec' 改写,bound/'' 保留后端列值
 *   · candidateLines      → 按生产车间过滤启用线;预填路径**不回退全量**(与手选回退的差异)
 *   · lineOptions         → 排线弹窗下拉:限定车间才筛,否则(新工序/车间没线)列全部启用线(2026-10-28)
 *   · applyLineDefaults   → 仅填空行;工序名两边 trim 后精确匹配;首道才用上次首道兜底;
 *                           改线模式(lockedFirst)首道不覆盖;脏线名/停用线/跨车间一律留空
 *   · 计划完工日期/换算率不被污染
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  candidateLines,
  lineOptions,
  pickRouteDefault,
  applyRouteDefaults,
  pickLineDefault,
  applyLineDefaults,
} from './routeDefaults.js'

const routeSet = new Set(['GY-CB-STD', 'GY-2026-10-0001'])

// ── ① pickRouteDefault:优先级 上次(∈routeSet)>绑定>空 ──

test('pickRouteDefault:上次在候选集 → last 优先于绑定', () => {
  const r = pickRouteDefault(
    { 工艺路线: 'GY-CB-STD', 上次工艺路线: 'GY-2026-10-0001', 上次路线来源单: 'GD-2026-10-0001', 上次日期: '2026-10-20' },
    routeSet,
  )
  assert.equal(r.route, 'GY-2026-10-0001')
  assert.equal(r.source, 'last')
  assert.equal(r.fromNo, 'GD-2026-10-0001')
  assert.equal(r.fromDate, '2026-10-20')
})

test('pickRouteDefault:上次已删路线(不在 routeSet)→ 回退绑定 bound', () => {
  const r = pickRouteDefault({ 工艺路线: 'GY-CB-STD', 上次工艺路线: 'GY-DELETED' }, routeSet)
  assert.equal(r.route, 'GY-CB-STD')
  assert.equal(r.source, 'bound')
  assert.equal(r.fromNo, '')
})

test('pickRouteDefault:无上次有绑定 → bound', () => {
  const r = pickRouteDefault({ 工艺路线: 'GY-CB-STD', 上次工艺路线: '' }, routeSet)
  assert.equal(r.route, 'GY-CB-STD')
  assert.equal(r.source, 'bound')
})

test('pickRouteDefault:全空 → 空串不预填', () => {
  const r = pickRouteDefault({ 工艺路线: '', 上次工艺路线: '' }, routeSet)
  assert.equal(r.route, '')
  assert.equal(r.source, '')
})

test('pickRouteDefault:上次两侧空白也认(归一后比对)', () => {
  const r = pickRouteDefault({ 工艺路线: '', 上次工艺路线: ' GY-CB-STD ' }, routeSet)
  assert.equal(r.route, 'GY-CB-STD')
  assert.equal(r.source, 'last')
})

// ── ①-b 同品名同规格族兜底(2026-10-29 用户口径:同规格同品名的产品实现) ──

test('pickRouteDefault:同物料无历史 → 用同品名同规格族路线兜底(source=spec)', () => {
  const r = pickRouteDefault(
    {
      工艺路线: '', 上次工艺路线: '',
      同品名同规格上次工艺路线: 'GY-CB-STD', 同品名同规格上次来源单: 'GD-2026-10-0201',
      同品名同规格上次日期: '2026-10-18', 同品名同规格上次审核状态: '已审核',
    },
    routeSet,
  )
  assert.equal(r.route, 'GY-CB-STD')
  assert.equal(r.source, 'spec')
  assert.equal(r.fromNo, 'GD-2026-10-0201')          // 来源单取族档,不是同物料档
  assert.equal(r.fromDate, '2026-10-18')
})

test('pickRouteDefault:同物料有历史时族不覆盖(优先级=同物料>族,2026-10-29 拍板)', () => {
  const r = pickRouteDefault(
    { 上次工艺路线: 'GY-2026-10-0001', 上次路线来源单: 'GD-A', 同品名同规格上次工艺路线: 'GY-CB-STD', 同品名同规格上次来源单: 'GD-B' },
    routeSet,
  )
  assert.equal(r.route, 'GY-2026-10-0001')
  assert.equal(r.source, 'last')
  assert.equal(r.fromNo, 'GD-A')
})

test('pickRouteDefault:族路线已删(不在候选)→ 回退档案绑定', () => {
  const r = pickRouteDefault({ 工艺路线: 'GY-CB-STD', 同品名同规格上次工艺路线: 'GY-DELETED' }, routeSet)
  assert.equal(r.route, 'GY-CB-STD')
  assert.equal(r.source, 'bound')
})

test('pickRouteDefault:同物料上次已删 → 先下探族(不是直接回退绑定)', () => {
  const r = pickRouteDefault(
    { 上次工艺路线: 'GY-DELETED', 同品名同规格上次工艺路线: 'GY-CB-STD', 同品名同规格上次来源单: 'GD-C' },
    routeSet,
  )
  assert.equal(r.route, 'GY-CB-STD')
  assert.equal(r.source, 'spec')
  assert.equal(r.fromNo, 'GD-C')
})

test('applyRouteDefaults:source=spec 写族来源单/日期,审核状态取族审核状态', () => {
  const rows = [{
    工艺路线: 'GY-2026-10-0001', 路线审核状态: '已审核',     // 绑定档的旧值
    同品名同规格上次工艺路线: 'GY-CB-STD', 同品名同规格上次来源单: 'GD-D',
    同品名同规格上次日期: '2026-10-19', 同品名同规格上次审核状态: '未审核',
  }]
  applyRouteDefaults(rows, routeSet)
  assert.equal(rows[0].工艺路线, 'GY-CB-STD')        // 整行写入:绑定被族档覆盖
  assert.equal(rows[0].路线来源, 'spec')
  assert.equal(rows[0].路线来源单, 'GD-D')
  assert.equal(rows[0].路线来源日期, '2026-10-19')
  assert.equal(rows[0].路线审核状态, '未审核')        // 族路线没审核 → 前端红显/转单前置拦生效
})

test('applyRouteDefaults:族与同物料都无历史 → 保留后端绑定值与"未选择"状态', () => {
  const bound = { 工艺路线: 'GY-CB-STD', 路线审核状态: '已审核', 上次工艺路线: '', 同品名同规格上次工艺路线: '' }
  applyRouteDefaults([bound], routeSet)
  assert.equal(bound.工艺路线, 'GY-CB-STD')
  assert.equal(bound.路线来源, 'bound')
  assert.equal(bound.路线审核状态, '已审核')
  const none = { 工艺路线: '', 路线审核状态: '未选择', 上次工艺路线: '', 同品名同规格上次工艺路线: '' }
  applyRouteDefaults([none], routeSet)
  assert.equal(none.路线来源, '')
  assert.equal(none.路线审核状态, '未选择')
})

// ── ② applyRouteDefaults:整行写入语义 ──

test('applyRouteDefaults:绑定非空且上次存在 → 上次覆盖绑定(整行写入核心断言)', () => {
  const rows = [{ 工艺路线: 'GY-CB-STD', 路线审核状态: '已审核', 上次工艺路线: 'GY-2026-10-0001', 上次路线审核状态: '已审核', 上次路线来源单: 'GD-1', 上次日期: '2026-10-20' }]
  applyRouteDefaults(rows, routeSet)
  assert.equal(rows[0].工艺路线, 'GY-2026-10-0001')   // 不是"仅补空值":绑定被上次覆盖
  assert.equal(rows[0].路线审核状态, '已审核')
  assert.equal(rows[0].路线来源, 'last')
  assert.equal(rows[0].路线来源单, 'GD-1')
})

test('applyRouteDefaults:同物料多行各自独立携带、互不影响', () => {
  const rows = [
    { 订单号: 'SO-1', 工艺路线: '', 路线审核状态: '未选择', 上次工艺路线: 'GY-2026-10-0001', 上次路线审核状态: '未审核', 上次路线来源单: 'GD-A', 上次日期: '2026-10-19' },
    { 订单号: 'SO-2', 工艺路线: '', 路线审核状态: '未选择', 上次工艺路线: 'GY-CB-STD', 上次路线审核状态: '已审核', 上次路线来源单: 'GD-B', 上次日期: '2026-10-20' },
  ]
  applyRouteDefaults(rows, routeSet)
  assert.equal(rows[0].工艺路线, 'GY-2026-10-0001')
  assert.equal(rows[0].路线来源单, 'GD-A')
  assert.equal(rows[1].工艺路线, 'GY-CB-STD')
  assert.equal(rows[1].路线来源单, 'GD-B')
})

test('applyRouteDefaults:路线审核状态仅 source=last 改写;bound 行保留后端值', () => {
  // last:改写为 上次路线审核状态(可能未审核 → 前端红显+转单前置拦自动生效)
  const last = { 工艺路线: 'GY-CB-STD', 路线审核状态: '已审核', 上次工艺路线: 'GY-2026-10-0001', 上次路线审核状态: '未审核', 上次路线来源单: 'GD-A' }
  applyRouteDefaults([last], routeSet)
  assert.equal(last.路线审核状态, '未审核')
  // bound:保留后端按绑定算好的值
  const bound = { 工艺路线: 'GY-CB-STD', 路线审核状态: '已审核', 上次工艺路线: 'GY-DELETED', 上次路线审核状态: '未审核' }
  applyRouteDefaults([bound], routeSet)
  assert.equal(bound.工艺路线, 'GY-CB-STD')
  assert.equal(bound.路线审核状态, '已审核')
  // 空:保留后端 '未选择',不产生红显噪音(冷读#6)
  const none = { 工艺路线: '', 路线审核状态: '未选择', 上次工艺路线: '' }
  applyRouteDefaults([none], routeSet)
  assert.equal(none.工艺路线, '')
  assert.equal(none.路线审核状态, '未选择')
  assert.equal(none.路线来源, '')
})

test('applyRouteDefaults:source="" 行工艺路线写空串', () => {
  const rows = [{ 工艺路线: '   ', 路线审核状态: '未选择', 上次工艺路线: null }]
  applyRouteDefaults(rows, routeSet)
  assert.equal(rows[0].工艺路线, '')
})

// ── ③ candidateLines:车间过滤、预填不回退全量 ──

const lines = [
  { 生产线: '7号机', 生产车间: '成型' },
  { 生产线: '切炭4(X)', 生产车间: '切炭' },
  { 生产线: '组装2(新厂)', 生产车间: '组装' },
  { 生产线: '组装1(旧厂)', 生产车间: '组装', 停用: 1 },
]

test('candidateLines:按生产车间过滤;停用线剔除', () => {
  const got = candidateLines(lines, '组装').map((l) => l.生产线)
  assert.deepEqual(got, ['组装2(新厂)'])           // 停用的组装1(旧厂)不进候选
  assert.equal(candidateLines(lines, '成型').length, 1)
})

test('candidateLines:预填路径不回退全量 —— 车间判不出/无匹配 → 空数组', () => {
  assert.deepEqual(candidateLines(lines, ''), [])
  assert.deepEqual(candidateLines(lines, '不存在车间'), [])
  assert.deepEqual(candidateLines(undefined, '成型'), [])
})

// ── ③-b lineOptions(2026-10-28:新工序/未建线车间 ⇒ 全部启用产线) ──

test('lineOptions:限定车间(工序登记过固定车间且该车间有线)→ 只出该车间启用线', () => {
  const r = lineOptions({ 工序: '组装', 生产车间: '组装', 限定车间: true }, lines)
  assert.deepEqual(r.lines.map((l) => l.生产线), ['组装2(新厂)'])   // 停用线仍被剔除
  assert.equal(r.limited, true)
})

test('lineOptions:不限定车间(新工序/车间没线)→ 全部启用线,并标记 limited=false', () => {
  for (const step of [
    { 工序: '封箱', 生产车间: '', 限定车间: false },
    { 工序: '封箱', 生产车间: '装箱车间', 限定车间: false },   // 车间在产线档案里不存在
    { 工序: '封箱', 生产车间: '组装' },                         // 老后端没回限定车间开关
  ]) {
    const r = lineOptions(step, lines)
    assert.deepEqual(r.lines.map((l) => l.生产线), ['7号机', '切炭4(X)', '组装2(新厂)'])  // 停用剔除
    assert.equal(r.limited, false)
  }
})

test('lineOptions:说限定但该车间一条启用线都没有 → 仍列全部(绝不空下拉)', () => {
  const r = lineOptions({ 工序: '装箱', 生产车间: '装箱车间', 限定车间: true }, lines)
  assert.equal(r.lines.length, 3)
  assert.equal(r.limited, false)
})

// ── ④ applyLineDefaults / pickLineDefault ──

const lastByOp = [
  { 工序: '成型', 上次生产线: '7号机', 工单号: 'GD-2026-10-0001', 日期: '2026-10-20' },
  { 工序: '切炭 ', 上次生产线: '切炭4(X)', 工单号: 'GD-2026-10-0001', 日期: '2026-10-20' },   // 带尾空格的脏工序名
  { 工序: '组装', 上次生产线: '组装2(新厂)', 工单号: 'GD-2026-10-0001', 日期: '2026-10-20' },
]
const lastFirst = { 上次首道线: '7号机', 工单号: 'GD-2026-10-0001', 日期: '2026-10-20' }

test('applyLineDefaults:仅填空行;已排台账回填值不被污染', () => {
  const rows = [
    { 工序: '成型', 生产车间: '成型', 换算率: 7, 计划完工日期: '2026-11-01', 生产线: '' },
    { 工序: '切炭', 生产车间: '切炭', 换算率: 2, 计划完工日期: '2026-11-02', 生产线: '切炭3(Y)' },  // 台账回填
  ]
  applyLineDefaults(rows, lastByOp, lastFirst, lines)
  assert.equal(rows[0].生产线, '7号机')
  assert.equal(rows[0].线来源, 'last')
  assert.equal(rows[1].生产线, '切炭3(Y)')           // 不动
  assert.equal(rows[1].线来源, undefined)
})

test('applyLineDefaults:工序名带空格两边 trim 后精确匹配(冷读#7)', () => {
  const rows = [{ 工序: '切炭 ', 生产车间: '切炭', 生产线: '' }]   // 行侧也带空格
  applyLineDefaults(rows, lastByOp, null, lines)
  assert.equal(rows[0].生产线, '切炭4(X)')
})

test('applyLineDefaults:脏线名/停用线/跨车间一律不预填', () => {
  // 上次线不在该工序候选(跨车间)
  const cross = [{ 工序: '成型', 生产车间: '成型', 生产线: '' }]
  applyLineDefaults(cross, [{ 工序: '成型', 上次生产线: '组装2(新厂)' }], null, lines)
  assert.equal(cross[0].生产线, '')
  // 上次线是停用线
  const off = [{ 工序: '组装', 生产车间: '组装', 生产线: '' }]
  applyLineDefaults(off, [{ 工序: '组装', 上次生产线: '组装1(旧厂)' }], null, lines)
  assert.equal(off[0].生产线, '')
  // 上次线是档案外脏名
  const dirty = [{ 工序: '成型', 生产车间: '成型', 生产线: '' }]
  applyLineDefaults(dirty, [{ 工序: '成型', 上次生产线: '2号车间' }], null, lines)
  assert.equal(dirty[0].生产线, '')
})

test('applyLineDefaults:首道可用上次首道兜底;其余各道不用', () => {
  const rows = [
    { 工序: '成型', 生产车间: '成型', 生产线: '' },
    { 工序: '切炭', 生产车间: '切炭', 生产线: '' },
  ]
  applyLineDefaults(rows, [], lastFirst, lines)
  assert.equal(rows[0].生产线, '7号机')              // 首道兜底
  assert.equal(rows[1].生产线, '')                   // 其余各道没有 byOp 命中 ⇒ 留空
})

test('applyLineDefaults:改线模式(lockedFirst)首道不覆盖', () => {
  const rows = [{ 工序: '成型', 生产车间: '成型', 生产线: '' }]
  applyLineDefaults(rows, lastByOp, lastFirst, lines, { lockedFirst: true })
  assert.equal(rows[0].生产线, '')
  assert.equal(rows[0].线来源, undefined)
})

test('applyLineDefaults:计划完工日期/换算率不被污染', () => {
  const rows = [{ 工序: '成型', 生产车间: '成型', 换算率: 7, 计划完工日期: '2026-11-01', 生产线: '' }]
  applyLineDefaults(rows, lastByOp, null, lines)
  assert.equal(rows[0].换算率, 7)
  assert.equal(rows[0].计划完工日期, '2026-11-01')
})

test('pickLineDefault:pickLineDefault 单点 —— 无历史/首道兜底/候选校验', () => {
  assert.deepEqual(pickLineDefault({ 工序: '成型', 生产车间: '成型' }, new Map(), null, lines, true), { line: '', from: '' })
  assert.deepEqual(pickLineDefault({ 工序: '成型', 生产车间: '成型' }, new Map(), lastFirst, lines, true), { line: '7号机', from: 'last' })
  assert.deepEqual(pickLineDefault({ 工序: '成型', 生产车间: '成型' }, new Map(), lastFirst, lines, false), { line: '', from: '' })
  // 车间判不出(空)→ 候选为空 → 不预填
  assert.deepEqual(pickLineDefault({ 工序: '检验', 生产车间: '' }, new Map([['检验', '7号机']]), null, lines, false), { line: '', from: '' })
})
