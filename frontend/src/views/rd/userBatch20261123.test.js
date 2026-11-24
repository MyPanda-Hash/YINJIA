/**
 * 2026-11-23 用户批量七项（源码级守卫，加载真实配置文件断言）。
 *
 *   ① 立项申请表：二「立项背景」/ 六「项目输出」收窄，空间给五「项目开发目标」；
 *   ② 产品信息表：只读态空格也显示占位符（cfg.emptyMark）；
 *   ③ 产品文件流程管控：标题/副标题/数据来源三行字样删掉；
 *   ④ 项目/产品进度查询：新增的在最上面（按建单先后 id DESC）；
 *   ⑤⑥ 立项申请「填写」+「提交审批」合并为一步，日期取提交审批；
 *   ⑦ 产品进度展开能看到谁提交、谁审批通过。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { approvalSheetCfg } from '../../core/views/docSheetConfigs.js'
import { STAGES, buildFlow } from '../../core/rd/flowStages.js'
import { approvalLineOf, flowStepsOf } from '../../core/prod/productFlow.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const panels = read('../../core/views/RecordSheetPanels.vue')
const productFlowVue = read('./ProductFlow.vue')
const projectFlowSvc = read('../../../../backend/src/main/java/com/yinjia/mes/service/RdProjectFlowService.java')
const devProductSvc = read('../../../../backend/src/main/java/com/yinjia/mes/service/RdDevProductService.java')

const rowOf = (label) => approvalSheetCfg.rows.find((r) => r.label === label)

test('① 立项申请表：背景/输出收窄，腾出的高度全部给「项目开发目标」，总高不变', () => {
  const bg = rowOf('立项背景').h
  const out = rowOf('项目输出').h
  const goal = rowOf('项目开发目标').h
  assert.ok(bg < 133, `立项背景应比原 133 小，实际 ${bg}`)
  assert.ok(out < 94, `项目输出应比原 94 小，实际 ${out}`)
  assert.ok(goal > 210, `项目开发目标应比原 210 大，实际 ${goal}`)
  assert.equal(bg + out + goal, 133 + 94 + 210, '三者之和必须守恒（整张纸总高不变）')
})

test('② 产品信息表：只读态空格补占位符（emptyMark 只在只读分支补，不写值）', () => {
  assert.match(panels, /const text = signoffPaperText/, '只读分支要先算审批人文本')
  assert.match(panels, /return emptyMark\.value/, '空值必须回落 emptyMark')
  assert.ok(!/head\[\w+\]\s*=\s*emptyMark/.test(panels), '不许把占位符写进 head（会被当成真实数据保存）')
})

test('③ 产品文件流程管控：页头三行字样已删（模板里不再渲染）', () => {
  // 只判**模板/渲染**部分：注释里保留历史说明是允许的（源码注释不上屏）
  const tpl = productFlowVue.slice(0, productFlowVue.indexOf('<script'))
  assert.ok(!tpl.includes("tt('产品文件流程管控')"), '标题字样应已删除')
  assert.ok(!tpl.includes('按产品看这份开发包走到哪一步'), '副标题应已删除')
  assert.ok(!tpl.includes('数据来源：产品信息表与 4 个文件面板'), '数据来源应已删除')
  assert.ok(!tpl.includes('pfl-title'), '页头容器也该一起撤掉')
})

test('④ 两个进度查询：按建单先后倒序（最新在最上），不是单据编号字符串序', () => {
  assert.match(projectFlowSvc, /ORDER BY id DESC/, '项目流程必须按 id 倒序')
  assert.ok(!/ORDER BY \[单据编号\] DESC/.test(projectFlowSvc), '不能再用单据编号字符串序')
  assert.match(devProductSvc, /ORDER BY h\.id DESC/, '产品流程必须按 id 倒序')
})

test('⑤ 立项申请填写 + 提交审批已合并为一步', () => {
  const keys = STAGES.map((s) => s.key)
  assert.ok(!keys.includes('applyFill'), '旧的「填写」步应已合并')
  assert.ok(!keys.includes('applySubmit'), '旧的「提交审批」步应已合并')
  assert.equal(keys[0], 'applyFilled')
  assert.equal(STAGES[0].name, '立项申请填写提交单据')
  assert.equal(STAGES.length, 9)
})

test('⑥ 合并步的日期取「提交审批」时间，不是建草稿时间', () => {
  const base = {
    approvalNo: 'LXA-2026-11-0001', createdAt: '2026-11-20 11:22:59',
    customer: '客户A', projectName: '机型B',
    approvalStatus: { pending: 'Y', pendingBy: 'zhangsan', pendingAt: '2026-11-23 17:21:31' },
    trail: [{ panel: 'RD_APPROVAL', action: 'SUBMIT', operator: 'zhangsan', at: '2026-11-23 17:21:31' }],
  }
  const f = buildFlow(base, {}, '2026-11-23 18:00:00')
  const step = f.steps[0]
  assert.equal(step.at, '2026-11-23 17:21:31', '必须用提交审批时间')
  assert.notEqual(step.at, '2026-11-20 11:22:59', '不能再显示建草稿时间')
  assert.equal(f.currentKey, 'applyApprove', '提交后应卡在审批通过')
})

test('⑦ 产品进度：步骤带提交/审批信息，能拼出「谁提交 · 谁审批」', () => {
  assert.match(devProductSvc, /approvalInfoOf/, '后端要下发提交/审批信息')
  const steps = flowStepsOf({
    '产品编号': 'C-1', '单据编号': 'PI-1', state: '已审核',
    submitBy: '张莉', submitAt: '2026-11-23 17:21', approveBy: '冯总', approveAt: '2026-11-23 17:30',
    nodes: [{ panel: 'RD_SPEC_DOC', label: '规格书', docNo: 'SD-1', state: '审批中',
      submitBy: '陈秀丽', submitAt: '2026-11-23 17:40', pending: true }],
  })
  assert.equal(approvalLineOf(steps[0]), '提交 张莉 2026-11-23 17:21 · 审批通过 冯总 2026-11-23 17:30')
  assert.equal(approvalLineOf(steps[1]), '提交 陈秀丽 2026-11-23 17:40 · 等待审批')
  assert.equal(approvalLineOf(flowStepsOf({ nodes: [] })[0]), '', '没有数据就是空串，不编造')
  assert.match(productFlowVue, /pfl-step-approval/, '展开行要渲染这一行')
})
