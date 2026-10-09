/* TEMP probe (2026-10-09): control test for the "同步进度" log line.
   Logs in, POSTs callButton 同步进度 on RD_PLAN, prints HTTP status + body.
   If the backend log grows, the logging pipeline works and the user's click never reached it. */
const API = 'http://127.0.0.1:8090/api'
async function main() {
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: process.argv[2] || 'cp', password: '123456', factory: process.argv[3] || 'HSDZ_MES' }),
  })
  const lj = await login.json()
  if (lj?.code !== 200) { console.log(`LOGIN_FAIL ${login.status} ${JSON.stringify(lj)}`); return }
  const token = lj.data.token
  console.log(`login ok user=${lj.data.user.realName} isAdmin=${lj.data.user.isAdmin}`)
  const r = await fetch(`${API}/px/callButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'RD_PLAN', buttonName: '同步进度', formData: {}, buttonParam: {} }),
  })
  const t = await r.text()
  console.log(`HTTP=${r.status} body=${t.slice(0, 300)}`)
}
main().catch((e) => { console.log('ERR ' + e.message) })
