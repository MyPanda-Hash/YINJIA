/**
 * _e2e-rd-owner-flow.mjs — 立项 4 步流程 + 反审核联动的端到端验证(2026-10-19)
 *
 * 在**测试账套 YJ_TEST**(HSDZ_MES_TEST,可随意造数)里跑完:
 *   建单 → 审核 → 定级 → 分发对接人 → 确认责任人 → (此时保存实施计划应被拦)
 *   → 责任人确认收到 → 保存实施计划成功 → 实施计划审核 → 立项弃审
 *   → 校验:实施计划被联动退回草稿、立项的对接人/责任人/等级/确认标记全清空。
 *
 * 用法:node tools/archive/_rd-owner-flow-20261019/_e2e-rd-owner-flow.mjs
 */
const BASE = process.env.BASE || 'http://127.0.0.1:8090'
const FACTORY = process.env.FACTORY || 'YJ_TEST'
const LIAISON = process.env.LIAISON || 'cp'
const OWNER = process.env.OWNER || 'cp'
let NO = 'LXA-E2E-' + Date.now().toString().slice(-6)

let token = ''
const H = async (p, b) => {
  const r = await fetch(BASE + p, {
    method: b ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  })
  const txt = await r.text()
  let j = null
  try { j = JSON.parse(txt) } catch { j = { raw: txt } }
  return { status: r.status, body: j, text: txt }
}
const btn = (panelCode, buttonName, formData) =>
  H('/api/px/callButton', { panelCode, buttonName, formData, buttonParam: {} })
const show = (tag, r) => console.log(`${tag} → ${r.status} ${JSON.stringify(r.body?.message || r.body?.data || r.body).slice(0, 200)}`)

;(async () => {
  const login = await H('/api/auth/login', { userName: 'admin', password: '123456', factory: FACTORY })
  token = login.body?.data?.token
  if (!token) { console.log('LOGIN FAIL', login.text.slice(0, 200)); process.exit(1) }
  console.log(`[${FACTORY}] 登录 ok,立项单号 ${NO}`)

  const created = await btn('RD_APPROVAL', '保存', {
    单据编号: NO, 单据日期: '2026-10-19', 项目名称: '立项流程E2E', 申请立项人: 'admin', 需求简述: '流程改造验证',
  })
  show('① 建单保存', created)
  // 服务端会按号池重新发号 —— 后面所有动作都用它回传的编号
  const docNo = String(created.body?.data?.编号 || NO)
  NO = docNo
  console.log('   实际单号:', NO)
  show('② 提交审批', await btn('RD_APPROVAL', '提交审批', { 编号: NO }))
  // 用户口径「冯总审核及定级」= 审批通过 + 定级同一动作(2026-10-08)
  show('③ 审批通过并定级', await btn('RD_APPROVAL', '审批通过', { 编号: NO, 项目等级: '三级', 审核意见: 'E2E 流程验证' }))
  show('④ 分发对接人', await btn('RD_APPROVAL', '分发对接人', { 编号: NO, 对接人: LIAISON }))
  show('⑤ 确认责任人', await btn('RD_APPROVAL', '确认责任人', { 编号: NO, 项目责任人: OWNER }))

  const plan = { 单据编号: 'LXB-E2E-' + NO.slice(-6), 单据日期: '2026-10-19', 文档编号: NO, 项目名称: '立项流程E2E', 项目定级: '三级', 负责人: OWNER }
  show('⑥ 未确认就保存实施计划(应被拦)', await btn('RD_PLAN', '保存', plan))
  show('⑦ 责任人确认收到', await btn('RD_APPROVAL', '责任人确认收到', { 编号: NO }))
  const saved = await btn('RD_PLAN', '保存', plan)
  show('⑧ 确认后保存实施计划(应成功)', saved)
  const planNo = String(saved.body?.data?.编号 || plan.单据编号)
  show('⑨ 实施计划审核', await btn('RD_PLAN', '审核', { 编号: planNo }))
  // 立项审批通过即归档;按 2026-10-18 的口径,归档单要先「申请修改」并经管理员审批(→修改中)才能弃审
  show('⑩ 立项申请修改', await btn('RD_APPROVAL', '申请修改', { 编号: NO, 修改原因: 'E2E:验证反审核联动' }))
  show('⑪ 修改审批通过', await btn('RD_APPROVAL', '修改审批通过', { 编号: NO }))
  show('⑫ 立项弃审(应联动退实施计划)', await btn('RD_APPROVAL', '弃审', { 编号: NO }))
  const planSt = await H('/api/px/queryFormDataList?panelCode=RD_PLAN&pageNo=1&pageSize=50', null)
  const hit = (planSt.body?.data?.rows || []).find((r) => String(r['单据编号']) === planNo)
  console.log('   实施计划', planNo, '状态 =', hit ? hit['单据状态'] : '(未取到)')

  // 校验
  const st = await H('/api/px/rdFlow/state?docNo=' + NO, null)
  console.log('\n立项流程状态:', JSON.stringify(st.body?.data))
  const planDoc = await H('/api/px/queryFormDataList', { panelCode: 'RD_PLAN', keyword: planNo, pageNo: 1, pageSize: 5 })
  console.log('实施计划单据状态:', JSON.stringify(planDoc.body?.data?.rows?.[0]?.单据状态 ?? planDoc.body?.data?.rows?.[0] ?? null).slice(0, 200))
})().catch((e) => { console.error('FAIL', e); process.exit(1) })
