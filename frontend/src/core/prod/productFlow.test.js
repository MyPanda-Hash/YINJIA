import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  STEP_STATE, currentStepOf, docMetaOf, filterFlowRows, flowKpisOf, flowStatusOf, flowStepsOf,
  nextStepOf, stateLabelOf, stepStateOf,
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

test('⑨ 每一步都带「最后操作时间」，取不到就是空串（2026-11-17 用户口径）', () => {
  // 用户原话：「每个都显示处理的日期，比如我是2026年11月17日13:31分操作的」
  const steps = flowStepsOf(row('A-1', '甲', '已归档', [
    node('RD_SPEC_DOC', '规格书', '开发完毕', true, false, 'S-1'),
    { panel: 'RD_MOLD_PROC', label: '烧结工艺清单', state: '开发中', done: false, docNo: 'M-1', at: '2026-11-17 13:31' },
    node('RD_ASM_PROC', '组装工艺清单', '未开发', false),
    node('RD_INSP_PLAN', '出货检验计划表', '未开发', false),
  ], { at: '2026-11-16 09:05' }))
  assert.equal(steps.length, 5)
  assert.equal(steps[0].at, '2026-11-16 09:05', '产品信息表那步要带时间')
  assert.equal(steps[1].at, '', '后端没给时间 ⇒ 空串（界面显示「—」），不许编造')
  assert.equal(steps[2].at, '2026-11-17 13:31', '节点时间原样透传')
})

test('⑩ 步骤对象不再把 owner 当唯一身份信息（2026-11-17 去处理人）', () => {
  // 用户原话：「把处理人的名字去掉」⇒ 页面改成渲染 at；owner 仍透传，别顺手删掉（其它视图/导出在用）
  const steps = flowStepsOf(row('A-1', '甲', '已归档', FULL, { 填写人: '张莉' }))
  assert.equal(steps[0].owner, '张莉', 'owner 仍要透传（后端仍下发，接口契约不变）')
  assert.ok('at' in steps[0], '每个步骤都要有 at 字段（页面渲染它）')
  assert.ok(steps.every((s) => 'at' in s), '4 个文件节点同样要有 at 字段')
})

test('⑪ 新建的产品信息表（还没填产品编号）也必须出现在列表里、且排在最前（2026-11-17）', () => {
  // 用户原话：「新增的产品信息应该放最上面，不要放下面」。
  // 曾经的真因:页面 load() 把「产品编号为空」的行整条丢掉 ⇒ 新建单根本不显示,更谈不上排最前。
  const page = readFileSync(new URL('../../views/rd/ProductFlow.vue', import.meta.url), 'utf8')
  // ① 过滤条件不再只看产品编号
  const load = page.match(/const list = \(res && res\.data && res\.data\.products\) \|\| \[\][\s\S]*?rows\.value = list\.filter[\s\S]*?\n/)[0]
  assert.match(load, /单据编号/, '过滤条件必须认可「有单据编号」的单（否则新建单被整条丢掉）')
  // ② 行键不能写死产品编号（空键会让多行互相撞车）
  assert.match(page, /:row-key="rowKeyOf"/, 'row-key 必须走 rowKeyOf（空产品编号会撞键）')
  assert.match(page, /function rowKeyOf/, '缺少 rowKeyOf 实现')
  const rk = page.match(/function rowKeyOf\(row\) \{[\s\S]*?\n\}/)[0]
  assert.match(rk, /单据编号/, 'rowKeyOf 要退回单据编号兜底')
})

test('⑫ 「产品数」KPI 必须与列表行数一致（新建未编号的单也要算）', () => {
  // 实测踩点:列表改完后显示 3 行,而 KPI 仍写「产品数 2」—— 两处口径漂了。
  const rows = [
    { 产品编号: '', 单据编号: 'PI-1', state: '草稿', nodes: [] },
    { 产品编号: 'T1', 单据编号: 'CP-1', state: '已归档', nodes: [] },
  ]
  assert.equal(flowKpisOf(rows).total, 2, '有单据编号的新单也要计入产品数（与列表同一个筛选口径）')
})

/* ═══ 2026-11-17 用户口径:「产品文件流程管控的格式可以按照项目流程管控的格式进行参考设计」═══
 * 参考实现 = frontend/src/views/rd/ProjectFlow.vue。逐项对齐的是**信息组织方式**,不是配色:
 *   ① 每一步都带状态标签(el-tag)。ProductFlow 原来只有「未开始」三个字,且把「草稿」原样吐出来;
 *   ② 展开行底部有「单据信息」dl(项目流程管控是 5 项:立项文档编号/申请立项人/实施计划单号/
 *      最后动作/进度查询行)⇒ 这边给 5 项:产品编号/产品名称/立项文档编号/产品信息表单号/最后动作;
 *   ③ 表头有「当前环节」列(几/几步 + 环节名),而不是只在展开行里说卡在哪;
 *   ④ 窄屏(≤768)收列 —— 否则 el-table 横向溢出,375 实测被裁。
 * 纯口径集中在 productFlow.js,页面只负责画(与项目流程管控同一条纪律)。
 */

test('⑬ 步骤状态要归一成三档给标签用（不再把「草稿」原样吐给界面）', () => {
  const steps = flowStepsOf(row('A-1', '甲', '草稿', [
    node('RD_SPEC_DOC', '规格书', '已归档', true, false, 'S-1'),
    node('RD_MOLD_PROC', '成型工艺清单', '草稿', false, false, 'M-1'),
    node('RD_ASM_PROC', '组装工艺清单', '未开始', false),
    node('RD_INSP_PLAN', '出货检验计划表', '未开始', false),
  ]))
  const byKey = Object.fromEntries(steps.map((s) => [s.key, s]))
  assert.equal(byKey.RD_SPEC_DOC.tone, 'done')
  assert.equal(byKey.RD_MOLD_PROC.tone, 'doing', '草稿=已建单未完成 ⇒ 进行中')
  assert.equal(byKey.RD_ASM_PROC.tone, 'none')
  // 状态文本:三档各有固定的中文说法（与项目流程管控的 stateText 同款）
  assert.equal(stateLabelOf(byKey.RD_SPEC_DOC), '已完成')
  assert.equal(stateLabelOf(byKey.RD_MOLD_PROC), '进行中')
  assert.equal(stateLabelOf(byKey.RD_ASM_PROC), '未开始')
})

test('⑭ 「当前环节」= 第一个没完成的步骤,给出第几步 + 环节名（表头列用）', () => {
  const steps = flowStepsOf(row('A-1', '甲', '已归档', [
    node('RD_SPEC_DOC', '规格书', '已归档', true, false, 'S-1'),
    node('RD_MOLD_PROC', '成型工艺清单', '未开始', false),
    node('RD_ASM_PROC', '组装工艺清单', '未开始', false),
    node('RD_INSP_PLAN', '出货检验计划表', '未开始', false),
  ]))
  const cur = currentStepOf(steps)
  assert.ok(cur, '还有未完成的步骤 ⇒ 要能说出卡在哪')
  // 5 步顺序 = 产品信息表 / 规格书 / 成型 / 组装 / 出货;
  // 本行时 产品信息表(已归档=done) + 规格书(done) 都完成 ⇒ 第一个没完成的是第 3 步成型工艺清单。
  assert.equal(cur.index, 3, '产品信息表+规格书已完成 ⇒ 卡在第 3 步')
  assert.equal(cur.step.label, '成型工艺清单')
  assert.equal(cur.text, '3/5', '表头显示成「3/5」这种形态')
  // 全部完成 ⇒ null（表头显示「已完成」）
  const allDone = [1, 2, 3, 4, 5].map((i) => ({ key: 'K' + i, label: 'x' + i, tone: 'done', state: '已归档', at: '' }))
  assert.equal(currentStepOf(allDone), null)
})

test('⑮ 展开行「单据信息」五项与项目流程管控同构（纯函数产出，页面不拼装）', () => {
  const r0 = row('A-9', '甲产品', '已归档', [
    node('RD_SPEC_DOC', '规格书', '已归档', true, false, 'S-9'),
    node('RD_MOLD_PROC', '成型工艺清单', '未开始', false),
    node('RD_ASM_PROC', '组装工艺清单', '未开始', false),
    node('RD_INSP_PLAN', '出货检验计划表', '未开始', false),
  ], { 填写人: '张莉', at: '2026-11-17 13:31' })
  const meta = docMetaOf(r0)
  assert.deepEqual(meta.map((m) => m.label), ['产品编号', '产品名称', '立项文档编号', '产品信息表单号', '最后动作'])
  assert.equal(meta[0].value, 'A-9')
  assert.equal(meta[3].value, 'CP-A-9', '「产品信息表单号」= 该产品的产品信息表单据编号')
  assert.equal(meta[4].value, '2026-11-17 13:31')
  // 空值统一显示「-」，不显示 undefined/空串（与项目流程管控的 `|| '-'` 同口径）
  const blank = docMetaOf({ 产品编号: '', 产品名称: '', 立项文档编号: '', 单据编号: '', at: '' })
  assert.ok(blank.every((m) => m.value === '-'), '空值一律显示 -')
})

/* ═══ 2026-11-20 用户口径 ═══
 * ① 「每个步骤的填写负责人没显示出来」—— 上一轮 actor 只映射到产品信息表那一步，
 *    4 张文件的 actor 被 flowStepsOf 丢掉；产品信息表那步后端又没下发 actor。
 * ② 「步骤行不要显示单据编号，应该显示产品编号」—— 单号只留在多单据清单里区分多张单。
 */

test('⑯ 步骤行渲染产品编号 + 填写人，不再渲染单据编号；多单据清单仍保留单号', () => {
  const r = row('A-54-08', '阻垢滤芯', '已归档', [
    {
      panel: 'RD_SPEC_DOC', label: '规格书', state: '已归档', done: true, docNo: 'SD-0013',
      at: '2026-11-06 13:52', actor: '陈秀丽',
      docs: [{ no: 'SD-0013', state: '已归档', at: '2026-11-06 13:52', actor: '陈秀丽' }],
    },
    {
      panel: 'RD_MOLD_PROC', label: '成型工艺清单', state: '开发中', done: false, docNo: 'MP-0029',
      at: '2026-11-17 14:15', actor: '刘磊',
      docs: [
        { no: 'MP-0029', state: '开发中', at: '2026-11-17 14:15', actor: '刘磊' },
        { no: 'MP-0020', state: '已归档', at: '2026-11-10 13:58', actor: '系统管理员' },
      ],
    },
    { panel: 'RD_ASM_PROC', label: '组装工艺清单', state: '未开发', done: false },
    { panel: 'RD_INSP_PLAN', label: '出货检验计划表', state: '未开发', done: false },
  ], { actor: '谢琴', at: '2026-11-13 14:41' })

  const steps = flowStepsOf(r)
  // 纯函数：每一步都带产品编号（不是单据编号）；节点的 actor/docs 必须透传
  assert.equal(steps[0].productCode, 'A-54-08', '产品信息表那步带产品编号')
  assert.equal(steps[0].actor, '谢琴', '产品信息表那步带填写人')
  assert.equal(steps[1].productCode, 'A-54-08', '文件节点同样带产品编号')
  assert.equal(steps[1].actor, '陈秀丽', '文件节点的 actor 必须透传（上一轮漏映射）')
  assert.equal(steps[2].actor, '刘磊')
  assert.deepEqual(steps[2].docs.map((d) => d.no), ['MP-0029', 'MP-0020'], '多张单全部透传')
  assert.ok(steps[2].docs.every((d) => d.productCode === 'A-54-08'), '多单据清单每行带产品编号')
  assert.equal(steps[3].docs.length, 0, '没有单就空数组')

  // 页面模板：步骤行读 productCode/actor，绝不能读 st.docNo；多单据清单读 d.no
  const page = readFileSync(new URL('../../views/rd/ProductFlow.vue', import.meta.url), 'utf8')
  const stepRow = page.match(/<div class="pfl-step-row">[\s\S]*?<\/div>/)[0]
  assert.doesNotMatch(stepRow, /st\.docNo/, '步骤行不得再渲染单据编号')
  assert.match(stepRow, /st\.productCode/, '步骤行要渲染产品编号')
  assert.match(stepRow, /st\.actor/, '步骤行要渲染填写人')
  const docList = page.match(/<ul[^>]*class="pfl-docs"[\s\S]*?<\/ul>/)[0]
  assert.match(docList, /d\.no/, '多单据清单必须保留单据编号（区分多张单必需）')
  assert.match(docList, /d\.productCode/, '多单据清单每行补产品编号')
  assert.match(docList, /d\.actor/, '多单据清单每行补填写人')
  assert.match(docList, /@click\.stop="openDoc\(d\.no\)"/, '点单号跳转的行为不变')
})

test('⑰ 产品信息表那步：后端 actor 优先，缺失时回落「填写人」', () => {
  const withFiller = flowStepsOf(row('A-1', '甲', '已归档', FULL, { 填写人: '谢琴' }))
  assert.equal(withFiller[0].actor, '谢琴', '旧后端没有 actor 时也不能空着')
  const withActor = flowStepsOf(row('A-1', '甲', '已归档', FULL, { 填写人: '谢琴', actor: '张莉' }))
  assert.equal(withActor[0].actor, '张莉', '后端 actor 已解析成姓名时优先用它')
})

test('⑱ 后端产品信息表行也下发 actor；姓名解析走 displayName，兜底列必须真实存在', () => {
  const svc = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/RdDevProductService.java', import.meta.url), 'utf8')
  assert.match(svc, /one\.put\("actor", lastActorOf\("RD_PROD_INFO", no\)\)/,
    '产品信息表行必须下发 actor（上一轮只给 nodeOf 加了）')
  assert.match(svc, /displayName\(str\(/, 'actor 要解析成姓名（取不到姓名回落账号）')
  assert.doesNotMatch(svc, /SELECT shr, archived_by/, 'yj_doc_status 没有 archived_by 列（实测 207），不能再查')
  assert.match(svc, /SELECT shr, pending_by, modify_appr_by FROM yj_doc_status/,
    '第二级兜底改查真实列：shr / pending_by / modify_appr_by')
})
