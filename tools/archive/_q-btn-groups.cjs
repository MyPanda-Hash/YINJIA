/* 临时排查:看非审批权账号在立项申请上拿到哪些按钮组(纯接口,不起浏览器) */
const API = 'http://127.0.0.1:8090/api'

async function login(userName, factory) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory }),
  })
  const j = await r.json()
  if (j?.code !== 200) throw new Error(`登录失败 ${userName}: ${JSON.stringify(j)}`)
  return j.data
}

async function main() {
  for (const user of ['glm53', 'liulei', 'cp']) {
    const d = await login(user, 'HSDZ_MES')
    const token = d.token
    const u = d.user
    console.log(`\n=== ${user}（${u.realName}）isAdmin=${u.isAdmin} approvePanels=${JSON.stringify(u.approvePanels)} ===`)
    const r = await fetch(`${API}/px/getPanelConfig?panelCode=RD_APPROVAL`, { headers: { Authorization: `Bearer ${token}` } })
    const cfg = await r.json()
    const groups = cfg?.data?.metadata?.buttonGroups || []
    for (const g of groups) {
      const acts = g.actions || g.items || []
      console.log(`  [组] ${g.name}  →  ${JSON.stringify(acts)}`)
    }
  }
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
