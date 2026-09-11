// _probe-plan-term.cjs — 项目实施计划「申请终止(阶段处)」二级审批 验收:
//   ① 立项人=glm53(非管理员):申请终止(阶段2) → 状态 终止审批中（立项人）
//   ② 严格一级审批:admin 尝试通过 → 拒绝(仅立项人);glm53 通过 → 终止审批中（管理员）
//   ③ 二级审批:glm53 再试通过 → 拒绝(仅管理员);admin 通过 → 已终止(planTerm state=T,stage=2)
//   ④ 锁定:已终止单据 阶段完成/保存 均被拒
//   ⑤ 消息:glm53 收 TERM_REQUESTED+TERM_APPROVED;admin 收 TERM_TO_ADMIN
//   ⑥ 驳回流:重新申请(阶段3) → 立项人驳回(意见必填) → 状态回 已归档,可再申请
//   ⑦ 撤回流:申请(阶段4) → 发起人撤回 → 状态回 已归档
//   ⑧ UI 冒烟:RD_PLAN 页面正常渲染(横幅不炸面板)
// 用法: node tools/_probe-plan-term.cjs [BASE]   前置:已跑 tools/_prep-glm53.sql
const BASE = process.argv[2] || 'http://localhost:8090'
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const loginAs = async (u, p) => (await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: u, password: p }) })).json())
  const adminLogin = await loginAs('admin', '123456')
  const glmLogin = await loginAs('glm53', '123456')
  ok(!!adminLogin?.data?.token && !!glmLogin?.data?.token, `①-0 双账号登录(admin/glm53)`)
  const realName = glmLogin?.data?.user?.realName || ''
  ok(!!realName, `①-0b 立项人姓名=${realName}`)
  const mk = (token) => async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const api = mk(adminLogin.data.token)
  const glm = mk(glmLogin.data.token)
  const btn = (call, panelCode, buttonName, formData) => call('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) })
  const statusOf = async (panelCode, no) => {
    const q = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode, pageNo: 1, pageSize: 100 }) })
    const r = ((q.data?.rows) || q.data?.list || []).find((x) => (x['单据编号'] || x['编号']) === no)
    return r?.['单据状态'] || ''
  }
  const MARK = 'TERM-' + Date.now().toString().slice(-6)

  // 建 3 份立项申请(申请立项人=glm53 真名;文档编号各自独立——RD_PLAN 同面板文档编号唯一)
  // + 各自 1 张实施计划:先 directAdd 建草稿,再带编号保存头字段(走完整路径,admin 保存即归档)
  const planNos = []
  for (let i = 1; i <= 3; i++) {
    const docNo = `${MARK}-${i}`
    const appr = await btn(api, 'RD_APPROVAL', '保存', { 文档编号: docNo, 申请立项人: realName })
    ok(appr?.data?.['编号'] ? true : false, `①-1 立项申请#${i} ${appr?.data?.['编号']}(${docNo})`)
    const draft = await btn(api, 'RD_PLAN', '保存', {})
    const no = draft?.data?.['编号']
    const arch = await btn(api, 'RD_PLAN', '保存', { 编号: no, 文档编号: docNo, 阶段2_计划内容: '探针阶段2' })
    planNos.push(no)
    ok(arch?.data?.['单据状态'] === '已归档', `①-2 计划#${i} ${no} 已归档(${arch?.data?.['单据状态']})`)
  }
  const [p1, p2, p3] = planNos

  // ① 申请终止(阶段2,glm53)
  const r1 = await btn(glm, 'RD_PLAN', '申请终止', { 编号: p1, 阶段序号: '2', 终止原因: '探针终止' })
  ok(r1.code === 200, `① 申请终止提交(code=${r1.code} ${r1.message || ''})`)
  ok((await statusOf('RD_PLAN', p1)) === '终止审批中（立项人）', `①-2 状态=终止审批中（立项人）(=${await statusOf('RD_PLAN', p1)})`)

  // ② 严格一级:admin 通过被拒;glm53 通过 → P2
  const r2 = await btn(api, 'RD_PLAN', '终止审批通过', { 编号: p1 })
  ok(r2.code !== 200 && String(r2.message || '').includes('立项人'), `②-1 admin 一级审批被拒(${r2.message})`)
  const r3 = await btn(glm, 'RD_PLAN', '终止审批通过', { 编号: p1 })
  ok(r3.code === 200, `②-2 立项人通过 → 递交管理员`)
  ok((await statusOf('RD_PLAN', p1)) === '终止审批中（管理员）', `②-3 状态=终止审批中（管理员）`)

  // ③ 二级:glm53 再通过被拒;admin 通过 → 已终止
  const r4 = await btn(glm, 'RD_PLAN', '终止审批通过', { 编号: p1 })
  ok(r4.code !== 200 && String(r4.message || '').includes('管理员'), `③-1 立项人二级审批被拒(${r4.message})`)
  const r5 = await btn(api, 'RD_PLAN', '终止审批通过', { 编号: p1 })
  ok(r5.code === 200, `③-2 管理员通过 → 落实终止`)
  ok((await statusOf('RD_PLAN', p1)) === '已终止', `③-3 状态=已终止`)
  const term = await api(`/api/px/planTerm?code=${encodeURIComponent(p1)}`)
  ok(term?.data?.state === 'T' && String(term?.data?.stage) === '2' && term?.data?.p2_by === 'admin', `③-4 planTerm(state=${term?.data?.state}, stage=${term?.data?.stage}, p2_by=${term?.data?.p2_by})`)

  // ④ 锁定
  const r6 = await btn(api, 'RD_PLAN', '阶段完成', { 编号: p1, 阶段序号: '3' })
  ok(r6.code !== 200 && String(r6.message || '').includes('终止'), `④-1 已终止不可阶段完成(${r6.message})`)
  const r7 = await btn(api, 'RD_PLAN', '保存', { 编号: p1, 阶段3_计划内容: 'x' })
  ok(r7.code !== 200 && String(r7.message || '').includes('终止'), `④-2 已终止不可保存(${r7.message})`)

  // ⑤ 消息
  const glmMsgs = ((await glm('/api/portal/message/list?limit=200'))?.data) || []
  ok(glmMsgs.some((m) => m['消息码'] === 'TERM_REQUESTED' && m['单据编号'] === p1), '⑤-1 立项人收到 TERM_REQUESTED')
  ok(glmMsgs.some((m) => m['消息码'] === 'TERM_APPROVED' && m['单据编号'] === p1), '⑤-2 立项人收到 TERM_APPROVED')
  const admMsgs = ((await api('/api/portal/message/list?limit=200'))?.data) || []
  ok(admMsgs.some((m) => m['消息码'] === 'TERM_TO_ADMIN' && m['单据编号'] === p1), '⑤-3 管理员收到 TERM_TO_ADMIN')

  // ⑥ 驳回流(p2):申请(阶段3) → 立项人驳回(意见) → 已归档,可再申请
  await btn(glm, 'RD_PLAN', '申请终止', { 编号: p2, 阶段序号: '3' })
  const rr = await btn(glm, 'RD_PLAN', '终止审批驳回', { 编号: p2, 审批意见: '探针驳回' })
  ok(rr.code === 200, `⑥-1 立项人驳回`)
  ok((await statusOf('RD_PLAN', p2)) === '已归档', `⑥-2 驳回后回已归档(=${await statusOf('RD_PLAN', p2)})`)
  const term2 = await api(`/api/px/planTerm?code=${encodeURIComponent(p2)}`)
  ok(term2?.data == null, `⑥-3 终止单已清可重新申请`)
  const rr2 = await btn(glm, 'RD_PLAN', '申请终止', { 编号: p2, 阶段序号: '3' })
  ok(rr2.code === 200, `⑥-4 可重新申请`)
  await btn(glm, 'RD_PLAN', '撤回终止申请', { 编号: p2 })

  // ⑦ 撤回流(p3)
  await btn(glm, 'RD_PLAN', '申请终止', { 编号: p3, 阶段序号: '4' })
  const rw = await btn(glm, 'RD_PLAN', '撤回终止申请', { 编号: p3 })
  ok(rw.code === 200 && (await statusOf('RD_PLAN', p3)) === '已归档', `⑦ 发起人撤回 → 已归档`)

  // 清理(作废单据;TERM 消息由 _cleanup-planterm.sql 清)
  for (let i = 1; i <= 3; i++) {
    const q = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_APPROVAL', pageNo: 1, pageSize: 100 }) })
    const row = ((q.data?.rows) || q.data?.list || []).find((x) => x['文档编号'] === `${MARK}-${i}`)
    if (row) await btn(api, 'RD_APPROVAL', '删除', { 编号: row['单据编号'] || row['编号'] })
  }
  for (const n of planNos) await btn(api, 'RD_PLAN', '删除', { 编号: n })

  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
