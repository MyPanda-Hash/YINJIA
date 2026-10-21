/**
 * _q-srv-verify.mjs —— 服务器上线后核验(2026-10-21):版本 + 立项定级分发门禁
 * 用法:node _q-srv-verify.mjs http://36.140.66.163:8090 admin 123456
 */
const BASE = (process.argv[2] || 'http://36.140.66.163:8090').replace(/\/$/, '')
const U = process.argv[3] || 'admin'
const P = process.argv[4] || ''
const lr = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: U, password: P, factory: 'YJ' }),
})).json()
const token = lr?.data?.token
if (!token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const list = await (await fetch(`${BASE}/api/px/queryFormDataList`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ panelCode: 'RD_APPROVAL', condition: {}, pageNo: 1, pageSize: 50 }),
})).json()
const rows = list?.data?.list || []
console.log(`[立项申请] ${rows.length} 张`)
const pick = []
for (const r of rows.slice(0, 50)) {
  const no = r['单据编号'] || r['编号']
  if (!no) continue
  const st = await (await fetch(`${BASE}/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`, { headers: H })).json()
  const d = st?.data || {}
  pick.push({ no, status: d.status, level: d.level, liaison: d.liaison, owner: d.owner, canGradeDispatch: d.canGradeDispatch })
}
for (const p of pick) {
  console.log(`  ${p.no} | ${p.status} | 等级=${p.level || '(空)'} | 对接人=${p.liaison || '(空)'} | 责任人=${p.owner || '(空)'} | canGradeDispatch=${p.canGradeDispatch}`)
}
const stuck = pick.filter((p) => ['已审核', '已归档'].includes(p.status) && !p.liaison)
if (!stuck.length) console.log('\n(没有"已审批未分发对接人"的单,门禁无从实测)')
else console.log(`\n待分发对接人 ${stuck.length} 张;其中可点「定级分发」的 ${stuck.filter((p) => p.canGradeDispatch).length} 张`
  + `(等级已定的 ${stuck.filter((p) => p.level).length} 张)`)
