/**
 * 项目实施计划的「阶段」在**流程管控**与**纸面**两处必须同口径（2026-11-17 用户报障）。
 *
 * 用户原话（1117问题 #8）：「项目流程管控与实际流程不符」。
 *
 * 实测真因（LXA-2026-11-0019 / 计划 LXB-2026-11-0005）：
 *   该计划的三个阶段只填了「计划开始/计划完成」，「计划内容」留空 ⇒
 *   · 后端 plannedStages **只数计划内容** ⇒ =0 ⇒ 流程第 7 步「填写项目实施计划」显示未开始；
 *   · 第 9 步「实施计划审批通过并归档」只认 yj_doc_status.archived ⇒ 已完成；
 *   ⇒ 同一条时间轴自相矛盾（7/8 未做、9 已完成）。
 * 与同日上午修的「终止按钮消失」是同一个根因：判据只认一个字段。
 *
 * 纸面侧 hasPhaseContent 的语义是 5 字段任一非空 —— 三处必须一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const flow = readFileSync(new URL('./flowStages.js', import.meta.url), 'utf8')
const svc = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/RdProjectFlowService.java', import.meta.url), 'utf8')
const sheet = readFileSync(new URL('../views/DocSheet.vue', import.meta.url), 'utf8')
const stages = readFileSync(new URL('../progress/stageProgress.js', import.meta.url), 'utf8')

test('后端 plannedStages 必须按 5 字段任一非空计数（不能只数计划内容）', () => {
  assert.match(svc, /阶段.*_计划开始.*AS s/, '要取计划开始')
  assert.match(svc, /阶段.*_计划完成.*AS s/, '要取计划完成')
  assert.match(svc, /阶段.*_责任人.*AS s/, '要取责任人')
  assert.match(svc, /anyNonBlank\(content, begin, due, owner, actual\)/, '计数用 anyNonBlank 五字段')
})

test('前端：计划已归档/已审核也算「填写完成」（两条证据取或）', () => {
  assert.match(flow, /const planFilled = !!plan && \(planned > 0 \|\| s\(planSt\.archived\) === 'Y' \|\| !!s\(planSt\.shr\)\)/,
    'planFilled 要含归档/审核兜底')
  assert.match(flow, /put\('planFill', planFilled/, '第 7 步用 planFilled')
  assert.match(flow, /put\('planSubmit', !!\(planFilled && planSubmitted\)/, '第 8 步同样不能因 planned=0 卡住')
})

test('三处判据同源：纸面 / 流程 / 阶段汇总都用 5 字段', () => {
  assert.match(stages, /PHASE_FIELDS = \['计划内容', '计划开始', '计划完成', '实际完成', '责任人'\]/, '字段清单')
  // 纸面阶段框可见性也用了同一函数（本次顺带修「隐藏不保存」）
  assert.match(sheet, /hasPhaseContent\(props\.head \|\| \{\}, num\)/, '纸面可见性用 hasPhaseContent')
})
