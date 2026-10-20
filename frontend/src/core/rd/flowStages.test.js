/**
 * flowStages 单测 —— 研发「项目流程管控」环节判定(2026-10-20)。
 *
 * 【为什么必须钉死】这个面板的唯一价值就是"告我卡在哪"。判定一旦偏，
 * 用户会照着它去催错人 / 以为审批完了就敢往下走。所以把 12 种真实边界
 * 用两账套实测过的字段组合（rd_approval 备用1~4 / yj_doc_status / rd_plan / rd_progress_detail /
 * yj_form_approval 留痕）逐条钉住，数据形状与 PxController#rdFlow 出参一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFlow, STAGES } from './flowStages.js'

const NOW = '2026-10-20 15:00:00'

/** 立项申请事实(默认 = 刚填写完的草稿) */
function ap(over = {}) {
  return {
    approvalNo: 'LXA-2026-10-0100',
    approvalDocNo: '',
    projectName: '测试机型',
    customer: '甲客户',
    spec: '滤芯A',
    initiator: '张三',
    createdBy: 'zhangsan',
    createdAt: '2026-10-10 09:00:00',
    updatedAt: '2026-10-10 09:00:00',
    level: '',
    liaison: '',
    owner: '',
    ownerAck: '',
    ownerAckAt: '',
    approvalStatus: { pending: 'N', pendingBy: '', pendingAt: '', shr: '', shsj: '', archived: 'N', archivedAt: '', canceled: 'N', modifyState: '' },
    plans: [],
    progressRows: [],
    trail: [],
    ...over,
  }
}

const st = (over = {}) => ({ pending: 'N', pendingBy: '', pendingAt: '', shr: '', shsj: '', archived: 'N', archivedAt: '', canceled: 'N', modifyState: '', ...over })

/** 审批留痕行(panel 区分立项/计划两张单的同名动作) */
const t = (action, at, operator = 'admin', panel = 'RD_APPROVAL') => ({ panel, action, result: '', operator, at, opinion: '' })

/** 已审批通过 + 定级分发 + 责任人确认收到 + 计划已填 → 全部完成的完整项目 */
function fullProject(over = {}) {
  return ap({
    level: '三级',
    liaison: 'cp',
    owner: 'cp',
    ownerAck: 'cp',
    ownerAckAt: '2026-10-11 10:00:00',
    approvalStatus: st({ shr: 'admin', shsj: '2026-10-10 10:00:00', archived: 'Y', archivedAt: '2026-10-10 10:00:00' }),
    plans: [{
      no: 'LXB-2026-10-0100', docNo: 'LXA-2026-10-0100', projectName: '测试机型', level: '三级', owner: 'cp',
      createdAt: '2026-10-11 10:00:00', updatedAt: '2026-10-12 09:00:00', createdBy: 'admin',
      plannedStages: 3, doneStages: 0,
      status: st({ shr: 'admin', shsj: '2026-10-12 10:00:00', archived: 'Y', archivedAt: '2026-10-12 10:00:00' }),
    }],
    progressRows: ['LXJ2609040100 · 已立项'],
    trail: [
      t('SUBMIT', '2026-10-10 09:30:00', 'zhangsan'),
      t('APPROVE', '2026-10-10 10:00:00'),
      t('GRADE_DISPATCH', '2026-10-10 10:10:00'),
      t('OWNER', '2026-10-10 10:20:00'),
      t('OWNER_ACK', '2026-10-11 10:00:00'),
      t('AUTO_PLAN', '2026-10-11 10:00:00', 'admin', 'RD_PLAN'),
      t('SUBMIT', '2026-10-12 09:30:00', 'cp', 'RD_PLAN'),
      t('APPROVE', '2026-10-12 10:00:00', 'admin', 'RD_PLAN'),
    ],
    ...over,
  })
}

const stepOf = (flow, key) => flow.steps.find((s) => s.key === key)
const stateOf = (flow, key) => stepOf(flow, key).state

test('环节清单固定 10 步,顺序与业务链一致', () => {
  assert.deepEqual(STAGES.map((s) => s.key), [
    'applyFill', 'applySubmit', 'applyApprove', 'gradeDispatch', 'confirmOwner',
    'ownerAck', 'planFill', 'planSubmit', 'planArchive', 'progressSync',
  ])
  assert.equal(STAGES[0].name, '立项申请填写')
  assert.equal(STAGES[9].name, '进入项目进度查询')
})

test('① 只填了立项申请(草稿未提交):卡在"提交审批",待办人=申请立项人', () => {
  const f = buildFlow(ap(), {}, NOW)
  assert.equal(f.currentKey, 'applySubmit')
  assert.equal(stateOf(f, 'applyFill'), 'done')
  assert.equal(stateOf(f, 'applySubmit'), 'active')
  assert.equal(stateOf(f, 'applyApprove'), 'todo')
  assert.equal(f.pendingWith.name, '张三')
  assert.equal(f.stuckDays, 10, '2026-10-10 09:00 → 2026-10-20 15:00 = 10 天')
})

test('② 已提交待审批:卡在"审批通过",并落出提交人与提交时间', () => {
  const f = buildFlow(ap({
    approvalStatus: st({ pending: 'Y', pendingBy: 'zhangsan', pendingAt: '2026-10-19 09:00:00' }),
    trail: [t('SUBMIT', '2026-10-19 09:00:00', 'zhangsan')],
  }), { zhangsan: '张三' }, NOW)
  assert.equal(f.currentKey, 'applyApprove')
  assert.equal(stateOf(f, 'applySubmit'), 'done')
  assert.equal(stepOf(f, 'applySubmit').at, '2026-10-19 09:00:00')
  assert.match(stepOf(f, 'applySubmit').actor, /张三/)
  assert.equal(f.pendingWith.name, '审批人', '审批人还没落定 → 交给"有审批权的角色"')
  assert.equal(f.stuckDays, 1)
})

test('③ 已审批通过但没定级分发:卡在"定级分发",待办人=本单审批人', () => {
  const f = buildFlow(ap({
    approvalStatus: st({ shr: 'admin', shsj: '2026-10-19 10:00:00', archived: 'Y', archivedAt: '2026-10-19 10:00:00' }),
    trail: [t('SUBMIT', '2026-10-19 09:00:00', 'zhangsan'), t('APPROVE', '2026-10-19 10:00:00', 'admin')],
  }), { admin: '冯总' }, NOW)
  assert.equal(f.currentKey, 'gradeDispatch')
  assert.equal(stateOf(f, 'applyApprove'), 'done')
  assert.equal(f.pendingWith.account, 'admin')
  assert.equal(f.pendingWith.name, '冯总')
})

test('④ 定了级但没分发对接人 / 分了对接人没确认责任人:分别卡在两处', () => {
  const graded = buildFlow(ap({
    level: '三级',
    approvalStatus: st({ shr: 'admin', shsj: '2026-10-19 10:00:00' }),
    trail: [t('SUBMIT', '2026-10-19 09:00:00', 'zhangsan'), t('APPROVE', '2026-10-19 10:00:00', 'admin'), t('GRADE', '2026-10-19 10:05:00', 'admin')],
  }), { admin: '冯总' }, NOW)
  assert.equal(graded.currentKey, 'gradeDispatch', '等级有了但对接人空 → 仍算定级分发未完成')
  assert.match(stepOf(graded, 'gradeDispatch').detail, /三级/)
  assert.match(stepOf(graded, 'gradeDispatch').detail, /对接人/)

  const dispatched = buildFlow(ap({
    level: '三级', liaison: 'cp',
    approvalStatus: st({ shr: 'admin', shsj: '2026-10-19 10:00:00' }),
    trail: [t('APPROVE', '2026-10-19 10:00:00', 'admin'), t('GRADE_DISPATCH', '2026-10-19 10:05:00', 'admin')],
  }), { admin: '冯总', cp: '陈秀丽' }, NOW)
  assert.equal(dispatched.currentKey, 'confirmOwner')
  assert.equal(stateOf(dispatched, 'gradeDispatch'), 'done')
  assert.equal(dispatched.pendingWith.name, '陈秀丽', '确认责任人是"对接人"的动作')
})

test('⑤ 已确认责任人但责任人没确认收到:卡在责任人手上,且提示必须先确认才能填计划', () => {
  const f = buildFlow(ap({
    level: '三级', liaison: 'cp', owner: 'cp',
    approvalStatus: st({ shr: 'admin', shsj: '2026-10-19 10:00:00' }),
    trail: [t('APPROVE', '2026-10-19 10:00:00', 'admin'), t('GRADE_DISPATCH', '2026-10-19 10:05:00', 'admin'), t('OWNER', '2026-10-19 10:10:00', 'cp')],
  }), { cp: '陈秀丽', admin: '冯总' }, NOW)
  assert.equal(f.currentKey, 'ownerAck')
  assert.equal(f.pendingWith.name, '陈秀丽')
  assert.match(f.headline, /确认收到/)
})

test('⑥ 确认收到但计划还没建单:卡在"填写项目实施计划",并说明是系统自动建单还是手工建', () => {
  const f = buildFlow(ap({
    level: '三级', liaison: 'cp', owner: 'cp', ownerAck: 'cp', ownerAckAt: '2026-10-19 11:00:00',
    approvalStatus: st({ shr: 'admin', shsj: '2026-10-19 10:00:00' }),
    trail: [t('APPROVE', '2026-10-19 10:00:00', 'admin'), t('OWNER_ACK', '2026-10-19 11:00:00', 'cp')],
  }), { cp: '陈秀丽' }, NOW)
  assert.equal(f.currentKey, 'planFill')
  assert.equal(stateOf(f, 'ownerAck'), 'done')
  assert.equal(f.pendingWith.name, '陈秀丽')
  assert.match(stepOf(f, 'planFill').detail, /尚未/)
})

test('⑦ 计划草稿已建但一个阶段都没填(=单据建了内容没开始填):detail 点名单号', () => {
  const f = buildFlow(fullProject({
    plans: [{
      no: 'LXB-2026-10-0100', docNo: 'LXA-2026-10-0100', projectName: '测试机型', level: '三级', owner: 'cp',
      createdAt: '2026-10-19 11:00:00', updatedAt: '2026-10-19 11:00:00', createdBy: 'admin',
      plannedStages: 0, doneStages: 0, status: st(),
    }],
    progressRows: [],
  }), { cp: '陈秀丽' }, NOW)
  assert.equal(f.currentKey, 'planFill')
  assert.equal(stateOf(f, 'planFill'), 'active')
  assert.match(stepOf(f, 'planFill').detail, /LXB-2026-10-0100/)
})

test('⑧ 阶段已填但没提交审批:卡在"提交审批",待办人=计划负责人', () => {
  const f = buildFlow(fullProject({
    plans: [{
      no: 'LXB-2026-10-0100', docNo: 'LXA-2026-10-0100', projectName: '测试机型', level: '三级', owner: 'cp',
      createdAt: '2026-10-19 11:00:00', updatedAt: '2026-10-19 12:00:00', createdBy: 'admin',
      plannedStages: 2, doneStages: 0, status: st(),
    }],
    progressRows: [],
    trail: [t('SUBMIT', '2026-10-10 09:30:00', 'zhangsan'), t('APPROVE', '2026-10-10 10:00:00', 'admin'),
      t('GRADE_DISPATCH', '2026-10-10 10:10:00', 'admin'), t('OWNER', '2026-10-10 10:20:00', 'admin'),
      t('OWNER_ACK', '2026-10-11 10:00:00', 'cp'), t('AUTO_PLAN', '2026-10-11 10:00:00', 'admin', 'RD_PLAN')],
  }), { cp: '陈秀丽' }, NOW)
  assert.equal(f.currentKey, 'planSubmit')
  assert.equal(stepOf(f, 'planFill').state, 'done')
  assert.equal(f.pendingWith.name, '陈秀丽')
})

test('⑨ 计划已提交待审批 / 已审批归档但没进进度查询:两步分开卡', () => {
  const pending = buildFlow(fullProject({
    plans: [{
      no: 'LXB-2026-10-0100', docNo: 'LXA-2026-10-0100', projectName: '测试机型', level: '三级', owner: 'cp',
      createdAt: '2026-10-19 11:00:00', updatedAt: '2026-10-19 12:00:00', createdBy: 'admin',
      plannedStages: 2, doneStages: 0, status: st({ pending: 'Y', pendingBy: 'cp', pendingAt: '2026-10-19 12:00:00' }),
    }],
    progressRows: [],
    trail: [t('SUBMIT', '2026-10-19 09:00:00', 'zhangsan'), t('APPROVE', '2026-10-19 10:00:00', 'admin'),
      t('OWNER_ACK', '2026-10-19 11:00:00', 'cp'), t('SUBMIT', '2026-10-19 12:00:00', 'cp', 'RD_PLAN')],
  }), { cp: '陈秀丽' }, NOW)
  assert.equal(pending.currentKey, 'planArchive')
  assert.equal(pending.pendingWith.name, '审批人')

  const archived = buildFlow(fullProject({ progressRows: [] }), { cp: '陈秀丽' }, NOW)
  assert.equal(archived.currentKey, 'progressSync')
  assert.equal(stateOf(archived, 'planArchive'), 'done')
  assert.match(stepOf(archived, 'progressSync').detail, /同步/)
})

test('⑩ 全链路走完:10 步全 done,headline 说已完成,停留 0 天', () => {
  const f = buildFlow(fullProject(), { cp: '陈秀丽', admin: '冯总' }, NOW)
  assert.equal(f.doneCount, 10)
  assert.equal(f.currentKey, '')
  assert.match(f.headline, /完成/)
  assert.equal(f.stuckDays, 0, '2026-10-12 10:00 → 2026-10-20 15:00 超过 8 天:已完成的项目不再算"卡住天数"')
  assert.equal(stepOf(f, 'progressSync').detail.includes('LXJ'), true)
})

test('⑪ 老单没有审批留痕(功能上线前走的):靠 yj_doc_status 的 shr/archived 也判为已通过', () => {
  const f = buildFlow(ap({
    level: '二级', liaison: 'cp',
    approvalStatus: st({ shr: 'admin', shsj: '2026-09-01 10:00:00', archived: 'Y', archivedAt: '2026-09-01 10:00:00' }),
    trail: [],
  }), { admin: '冯总', cp: '陈秀丽' }, NOW)
  assert.equal(stateOf(f, 'applySubmit'), 'done')
  assert.equal(stateOf(f, 'applyApprove'), 'done')
  assert.equal(stepOf(f, 'applyApprove').at, '2026-09-01 10:00:00')
  assert.equal(f.currentKey, 'confirmOwner')
})

test('⑫ 弃审/作废的单据:不显示成"卡在某步",而是明确标出已弃审', () => {
  const f = buildFlow(fullProject({
    approvalStatus: st({ canceled: 'Y', shr: '', shsj: '', archived: 'N', archivedAt: '' }),
  }), {}, NOW)
  assert.equal(f.canceled, true)
  assert.match(f.headline, /弃审|作废/)
})

test('⑭ 状态没落库但后序已完成(实测 HSDZ_MES LXA-2026-10-0011):标 warn 并说明,不当成普通卡单', () => {
  const f = buildFlow(fullProject({
    ownerAck: '', ownerAckAt: '',
    trail: [t('SUBMIT', '2026-10-10 09:30:00', 'zhangsan'), t('APPROVE', '2026-10-10 10:00:00', 'admin'),
      t('GRADE_DISPATCH', '2026-10-10 10:10:00', 'admin'), t('OWNER', '2026-10-10 10:20:00', 'admin'),
      t('SUBMIT', '2026-10-11 09:00:00', 'cp', 'RD_PLAN'), t('APPROVE', '2026-10-11 09:30:00', 'admin', 'RD_PLAN')],
  }), { cp: '陈秀丽' }, NOW)
  assert.equal(f.currentKey, 'ownerAck')
  assert.equal(stepOf(f, 'ownerAck').warn, true)
  assert.match(stepOf(f, 'ownerAck').detail, /后序环节已完成/)

  // 有 OWNER_ACK 留痕(即使 备用3 空)就算已确认 —— 老代码路径只写了留痕
  const withTrail = buildFlow(fullProject({
    ownerAck: '', ownerAckAt: '',
    trail: [t('SUBMIT', '2026-10-10 09:30:00', 'zhangsan'), t('APPROVE', '2026-10-10 10:00:00', 'admin'),
      t('GRADE_DISPATCH', '2026-10-10 10:10:00', 'admin'), t('OWNER', '2026-10-10 10:20:00', 'admin'),
      t('OWNER_ACK', '2026-10-10 10:30:00', 'cp'),
      t('SUBMIT', '2026-10-12 09:30:00', 'cp', 'RD_PLAN'), t('APPROVE', '2026-10-12 10:00:00', 'admin', 'RD_PLAN')],
  }), { cp: '陈秀丽' }, NOW)
  assert.equal(withTrail.currentKey, '')
  assert.equal(withTrail.doneCount, 10)
})

test('⑬ 停留天数按"最后一次动作"算,不是按建档时间', () => {
  const f = buildFlow(fullProject({
    plans: [{
      no: 'LXB-2026-10-0100', docNo: 'LXA-2026-10-0100', projectName: '测试机型', level: '三级', owner: 'cp',
      createdAt: '2026-10-11 11:00:00', updatedAt: '2026-10-19 20:00:00', createdBy: 'admin',
      plannedStages: 2, doneStages: 0, status: st(),
    }],
    trail: [t('SUBMIT', '2026-10-10 09:30:00', 'zhangsan'), t('APPROVE', '2026-10-10 10:00:00', 'admin'),
      t('OWNER_ACK', '2026-10-11 10:00:00', 'cp')],
    progressRows: [],
  }), {}, '2026-10-19 22:00:00')
  assert.equal(f.currentKey, 'planSubmit')
  assert.equal(f.stuckDays, 0, '计划最后一次保存是 10-19 20:00,2 小时 → 0 天(未满 1 天按 0)')
})
