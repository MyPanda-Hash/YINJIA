const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
for (const st of ['未完成', '全部']) {
  const r = await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: st, limit: 300 }) })
  const j = await r.json()
  console.log(st, r.status, JSON.stringify(j).slice(0, 200))
}
