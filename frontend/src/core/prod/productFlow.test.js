import test from 'node:test'
import assert from 'node:assert/strict'
import {
  STEP_STATE, filterFlowRows, flowKpisOf, flowStatusOf, flowStepsOf, nextStepOf, stepStateOf,
} from './productFlow.js'

/**
 * 产品文件流程页的纯口径（2026-11-11 用户口径）。
 *
 * 用户原话：「再用设计库设计一个和项目流程管控面板一样的流程查看功能的面板去专门查看产品文件的
 * 流程管控，就是和产品信息表以及下面 4 个面板对应的流程」。
 *
 * 钉住的是"流程怎么读"：5 步（产品信息表 + 4 张文件）的步骤态、卡在哪一步、KPI 三种计数、
 * 列表筛选 —— 页面只负责画，不做第二次判定（否则两处口径会漂）。
 */

const node = (panel, label, state, done, reaudited = false, docNo = '') => ({ panel, label, state, done, reaudited, docNo })
const row = (code, name, state, nodes, extra = {}) => ({
  产品编号: code, 产品名称: name, 立项文档编号: 'LSKH' + code, 单据编号: 'CP-' + code, state, nodes,
  doneCount: nodes.filter((n) => n.done).length, ...extra,
})

const FULL = [
  node('RD_SPEC_DOC', '规格书', '开发完毕', true, false, 'S-1'),
  node('RD_MOLD_PROC', '烧结工艺清单', '开发完毕', true, false, 'M-1'),
  node('RD_ASM_PROC', '组装工艺清单', '开发完毕', true, false, 'A-1'),
  node('RD_INSP_PLAN', '出货检验计划表', '开发完毕', true, false, 'I-1'),
]
const HALF = [
  node('RD_SPEC_DOC', '规格书', '开发完毕', true, false, 'S-2'),
  node('RD_MOLD_PROC', '烧结工艺清单', '开发中', false, false, 'M-2'),
  node('RD_ASM_PROC', '组装工艺清单', '未开发', false, false, ''),
  node('RD_INSP_PLAN', '出货检验计划表', '未开发', false, true, ''),
]
const ZERO = [
  node('RD_SPEC_DOC', '规格书', '未开发', false, false, ''),
  node('RD_MOLD_PROC', '烧结工艺清单', '未开发', false, false, ''),
  node('RD_ASM_PROC', '组装工艺清单', '未开发', false, false, ''),
  node('RD_INSP_PLAN', '出货检验计划表', '未开发', false, false, ''),
]

test('① 5 步 = 产品信息表 + 4 张文件，顺序与后端 nodes 一致', () => {
  const steps = flowStepsOf(row('A-1', '甲', '已归档', FULL))
  assert.equal(steps.length, 5)
  assert.deepEqual(steps.map((s) => s.label),
    ['产品信息表', '规格书', '烧结工艺清单', '组装工艺清单', '出货检验计划表'])
  assert.equal(steps[0].docNo, 'CP-A-1', '第一步的单号取产品信息表的单据编号')
  assert.equal(steps[1].docNo, 'S-1')
})

test('② 步骤态三档：已完成 / 已建单未完成 / 未开始', () => {
  const steps = flowStepsOf(row('A-2', '乙', '已归档', HALF))
  assert.equal(steps[1].tone, STEP_STATE.done, 'done=true ⇒ done')
  assert.equal(steps[2].tone, STEP_STATE.doing, '有状态(开发中)但没完成 ⇒ doing')
  assert.equal(steps[3].tone, STEP_STATE.none, '「未开发」等同未开始 ⇒ none')
  assert.equal(stepStateOf(null), STEP_STATE.none)
  assert.equal(stepStateOf({ state: '未开始' }), STEP_STATE.none)
  assert.equal(stepStateOf({ state: '开发审核中' }), STEP_STATE.doing)
})

test('③ 产品信息表那一步按单据状态判：草稿=未开始、其它=进行中、已归档=完成', () => {
  assert.equal(flowStepsOf(row('B', 'b', '草稿', ZERO))[0].tone, STEP_STATE.none)
  assert.equal(flowStepsOf(row('B', 'b', '审批中', ZERO))[0].tone, STEP_STATE.doing)
  assert.equal(flowStepsOf(row('B', 'b', '已归档', ZERO))[0].tone, STEP_STATE.done)
})

test('④ 下一步 = 第一个没完成的步骤；全完成给 null（"卡在哪"就靠它）', () => {
  assert.equal(nextStepOf(flowStepsOf(row('A', 'a', '已归档', HALF))).label, '烧结工艺清单')
  assert.equal(nextStepOf(flowStepsOf(row('A', 'a', '已归档', FULL))), null)
})

test('⑤ KPI：总数 / 已完成 / 在研 / 一步没开工', () => {
  const rows = [
    row('A-1', '甲', '已归档', FULL, { allDone: true }),
    row('A-2', '乙', '已归档', HALF, { allDone: false }),
    row('A-3', '丙', '已归档', ZERO, { allDone: false }),
    { 产品编号: '', 产品名称: '没有编号的行不算' },
  ]
  assert.deepEqual(flowKpisOf(rows), { total: 3, done: 1, doing: 1, none: 1 })
  assert.deepEqual(flowKpisOf(null), { total: 0, done: 0, doing: 0, none: 0 })
})

test('⑥ 列表筛选：编号/名称/立项文档编号，大小写无关；只看未完成时剔掉全做完的', () => {
  const rows = [
    row('C-95-01', '炭棒滤芯', '已归档', FULL, { allDone: true }),
    row('A-48-43', '阻垢滤芯', '已归档', HALF, { allDone: false }),
  ]
  assert.deepEqual(filterFlowRows(rows, 'c-95').map((r) => r['产品编号']), ['C-95-01'])
  assert.deepEqual(filterFlowRows(rows, '阻垢').map((r) => r['产品编号']), ['A-48-43'])
  assert.deepEqual(filterFlowRows(rows, 'lskha-48').map((r) => r['产品编号']), ['A-48-43'], '立项文档编号也参与匹配')
  assert.deepEqual(filterFlowRows(rows, '', true).map((r) => r['产品编号']), ['A-48-43'])
  assert.equal(filterFlowRows(rows, '').length, 2, '空关键字不过滤')
})

test('⑨ 处理人：产品信息表=填写提交审批的人；规格书=二级负责人；其余=分发的负责人', () => {
  // 后端 /px/rdDevOverview 的下发口径（2026-11-11 用户口径）：
  //   「产品信息表显示的是填写提交审批的人，规格书是由产品信息表二级负责人来处理，
  //     成型、组装、出货这三个也是对应的产品信息表签核之后分发的对应的负责人来处理」
  const rowWithOwners = {
    ...row('A-9', '己', '已归档', [
      { ...node('RD_SPEC_DOC', '规格书', '开发中', false, false, 'S-9'), owner: '陈秀丽' },
      { ...node('RD_MOLD_PROC', '成型工艺清单', '未开发', false, false, ''), owner: '杨茂林' },
      { ...node('RD_ASM_PROC', '组装工艺清单', '未开发', false, false, ''), owner: '秦文静' },
      { ...node('RD_INSP_PLAN', '出货检验计划表', '未开发', false, false, ''), owner: '陈柯余' },
    ]),
    填写人: '李梓维',
  }
  const steps = flowStepsOf(rowWithOwners)
  assert.equal(steps[0].owner, '李梓维', '第一步 = 填写人（不是审核人）')
  assert.equal(steps[1].owner, '陈秀丽', '规格书 = 产品信息表二级负责人')
  assert.deepEqual(steps.slice(2).map((s) => s.owner), ['杨茂林', '秦文静', '陈柯余'], '其余三份 = 分发的负责人')
  assert.equal(flowStepsOf(row('B', 'b', '草稿', ZERO))[1].owner, '', '没有处理人就给空串，不编造')
})

test('⑧ 整包状态只看 4 张文件：产品信息表已归档但一份文件没起 = 未开工', () => {
  const archivedNoFiles = flowStatusOf(row('A', 'a', '已归档', ZERO))
  assert.equal(archivedNoFiles, STEP_STATE.none, '已归档只说明"允许开发",不等于开工')
  assert.equal(flowStatusOf(row('A', 'a', '已归档', FULL)), STEP_STATE.done)
  assert.equal(flowStatusOf(row('A', 'a', '已归档', HALF)), STEP_STATE.doing)
  assert.equal(flowStatusOf(null), STEP_STATE.none)
  // KPI 与行内状态必须同口径（历史 bug：KPI 只数"已完成"，行内按"已开工"）
  const k = flowKpisOf([row('A', 'a', '已归档', ZERO)])
  assert.equal(k.none, 1)
  assert.equal(k.doing, 0)
})

test('⑦ 待重走标记随节点透传（反审核后重做的那份文件）', () => {
  const steps = flowStepsOf(row('A', 'a', '已归档', HALF))
  assert.equal(steps[4].reaudited, true)
  assert.equal(steps[2].reaudited, false)
})
