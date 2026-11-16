import test from 'node:test'
import assert from 'node:assert/strict'
import { reportCapInfo, isOverCapMessage, conciseReportError, CAP_EPS } from './reportCap.js'

// 现场数据(2026-11-13,GD-2026-11-0012 行3,截图):成型 600/2500,装箱 1100/5000,
//   装箱可加工量 1200(上一道成型已审完工折成品),装箱可报 = 1200 − 1100 = 100
const OPS = [
  { 工序: '成型', 计划数量: 2500, 已报工: 600, 可加工量: 2500 },
  { 工序: '装箱', 计划数量: 5000, 已报工: 1100, 可加工量: 1200 },
]

test('reportCapInfo:后道(装箱)最多可报 = 可加工量 − 本道已报 = 1200 − 1100 = 100', () => {
  const r = reportCapInfo(OPS, '装箱', 200)
  assert.equal(r.op, '装箱')
  assert.equal(r.prevOp, '成型')
  assert.equal(r.isFirst, false)
  assert.equal(r.avail, 1200)
  assert.equal(r.reported, 1100)
  assert.equal(r.max, 100)
  assert.equal(r.qty, 200)
  assert.equal(r.over, true)
  assert.equal(r.overBy, 100)
})

test('reportCapInfo:填的数量正好等于可报 ⇒ 不算超(容差内)', () => {
  assert.equal(reportCapInfo(OPS, '装箱', 100).over, false)
  assert.equal(reportCapInfo(OPS, '装箱', 100 + CAP_EPS / 2).over, false)
  assert.equal(reportCapInfo(OPS, '装箱', 100.01).over, true)
})

test('reportCapInfo:首道(成型)可报 = 排产/可加工量 − 已报 = 2500 − 600 = 1900', () => {
  const r = reportCapInfo(OPS, '成型', 2000)
  assert.equal(r.isFirst, true)
  assert.equal(r.prevOp, '')
  assert.equal(r.max, 1900)
  assert.equal(r.over, true)
})

test('reportCapInfo:上一道还没流下来(可加工量 0)⇒ 最多可报 0,连 1 都不许', () => {
  const ops = [{ 工序: '成型', 计划数量: 500, 已报工: 500, 可加工量: 500 }, { 工序: '装箱', 计划数量: 500, 已报工: 0, 可加工量: 0 }]
  const r = reportCapInfo(ops, '装箱', 1)
  assert.equal(r.max, 0)
  assert.equal(r.over, true)
})

test('reportCapInfo:老接口没有 可加工量 ⇒ 退回计划量口径;工序找不到 ⇒ null', () => {
  const old = [{ 工序: '成型', 计划数量: 800, 已报工: 300 }]
  const r = reportCapInfo(old, '成型', 501)
  assert.equal(r.avail, 800)
  assert.equal(r.max, 500)
  assert.equal(r.over, true)
  assert.equal(reportCapInfo(old, '不存在', 1), null)
  assert.equal(reportCapInfo(null, '成型', 1), null)
})

test('isOverCapMessage:新旧后端文案+前端提示都认,普通错误不认', () => {
  assert.equal(isOverCapMessage('报工数量超出允许上限(本行工序[装箱]上限 1200(本道可加工量 1200,来自上一道已审完工折成品 1200),允许至 1212;已报 1100,本次 200)'), true)
  assert.equal(isOverCapMessage('报工数量超出可报上限:本道最多可报 100,本次 200'), true)
  assert.equal(isOverCapMessage('超出本道可报量:100'), true)
  assert.equal(isOverCapMessage('工单 GD-2026-11-0012 已结案,不能报工'), false)
  assert.equal(isOverCapMessage(''), false)
  assert.equal(isOverCapMessage(null), false)
})

test('conciseReportError:去掉前缀/建议尾巴,只留一句人话', () => {
  assert.equal(
    conciseReportError('报工没有提交成功:审核失败(工单 GD-2026-11-0012 已结案,不能报工)。请稍后重试,或直接到「工序报工单」手工建单。'),
    '(工单 GD-2026-11-0012 已结案,不能报工)',
  )
  // 括号不是必须去掉,但必须短、且不能还挂着"请稍后重试"
  const s = conciseReportError('报工提交失败:工单 GD-2026-11-0012 未排产,不能报工(先在快速排产排入产线)。请稍后重试')
  assert.ok(s.length <= 60)
  assert.ok(!s.includes('请稍后重试'))
  // 空串回退
  assert.equal(conciseReportError('', '提交报工失败'), '提交报工失败')
  assert.equal(conciseReportError(null, '提交报工失败'), '提交报工失败')
  // 超长截断
  assert.ok(conciseReportError('x'.repeat(200)).length <= 61)
})
