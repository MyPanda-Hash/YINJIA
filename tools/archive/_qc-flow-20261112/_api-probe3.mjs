const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const call = async (b) => (await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json())).data
for (const s of ['未完成', '已完成', '异常', '全部']) {
  const d = await call({ 状态: s, limit: 800 })
  const stage = {}
  for (const r of d['行']) stage[r['当前环节']] = (stage[r['当前环节']] || 0) + 1
  console.log(s, '汇总=' + JSON.stringify(d['汇总']), '环节=' + JSON.stringify(stage))
}
const d = await call({ 状态: '未完成', 仅需检验: true, limit: 800 })
console.log('未完成+仅需检验 汇总=' + JSON.stringify(d['汇总']))
