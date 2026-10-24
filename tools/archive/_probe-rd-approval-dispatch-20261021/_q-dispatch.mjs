/**
 * _q-dispatch.mjs —— 立项申请「定级分发」契约探针(2026-10-21 报障:审批通过后按钮置灰、发不出对接人)
 *
 * 用法:node _q-dispatch.mjs <base> <docNo> [YJ|YJ_TEST]
 *
 * 断言:
 *   ① 单据已归档/已审核、等级已定、对接人为空 ⇒ state.canGradeDispatch 必须 true(修前是 false)
 *   ② /px/callButton「定级分发」只传对接人(不带等级)⇒ 成功,等级沿用库内值
 *   ③ 对接人已分发 ⇒ canGradeDispatch 变 false(不能重复分发)
 *   ④ 反过来:请求带**不同**等级 ⇒ 被拒(改级必须弃审)
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const DOC = process.argv[3] || 'LXA-2026-10-0018'
const FACTORY = process.argv[4] || 'YJ_TEST'
const LIAISON = process.argv[5] || 'cp'
let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
const token = login?.data?.token
if (!token) { console.error('登录失败', JSON.stringify(login).slice(0, 200)); process.exit(1) }
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const state = async () => (await fetch(`${BASE}/api/px/rdFlow/state?docNo=${encodeURIComponent(DOC)}`, { headers: H }).then((r) => r.json()))?.data
const call = async (formData) => {
  const r = await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'RD_APPROVAL', buttonName: '定级分发', formData, buttonParam: {} }),
  })
  const j = await r.json().catch(() => ({}))
  return { http: r.status, ok: j?.code === 200 || j?.success === true, msg: j?.message || j?.msg || '' , raw: j }
}
const before = await state()
console.log(`[${FACTORY}] ${DOC} 等级=${before?.level || '(空)'} 对接人=${before?.liaison || '(空)'} status=${before?.status}`)
// ①
if (before?.level && !before?.liaison && before?.canGradeDispatch) ok('① 已定级未分发 ⇒ canGradeDispatch=true(按钮可点)')
else bad(`① canGradeDispatch 应为 true,实际 ${before?.canGradeDispatch}(level=${before?.level}, liaison=${before?.liaison})`)
// ④ 先试改级(应被拒,且不写库)
if (before?.level) {
  const other = ['一级', '二级', '三级', '四级'].find((x) => x !== before.level)
  const r4 = await call({ 编号: DOC, 项目等级: other, 对接人: LIAISON })
  if (!r4.ok && /不能改级/.test(r4.msg)) ok(`④ 改级被拒(「${before.level}」→「${other}」):${r4.msg}`)
  else bad(`④ 改级本应被拒,实际 http=${r4.http} ok=${r4.ok} msg=${r4.msg}`)
}
// ② 只传对接人
const r2 = await call({ 编号: DOC, 对接人: LIAISON })
if (r2.ok) ok(`② 只传对接人即分发成功(等级沿用):端口 ${r2.http}`)
else bad(`② 分发失败:http=${r2.http} msg=${r2.msg} ${JSON.stringify(r2.raw).slice(0, 300)}`)
const after = await state()
if (after?.liaison === LIAISON && after?.level === before?.level) ok(`②' 库内已写:对接人=${after.liaison} 等级=${after.level}(沿用未变)`)
else bad(`②' 库内不符:对接人=${after?.liaison} 等级=${after?.level}`)
// ③
if (after?.canGradeDispatch === false) ok('③ 已分发后 canGradeDispatch=false(不能重复分发)')
else bad(`③ 已分发后应禁止,实际 canGradeDispatch=${after?.canGradeDispatch}`)
console.log(fail === 0 ? '\n[RESULT] ALL PASS' : `\n[RESULT] ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
