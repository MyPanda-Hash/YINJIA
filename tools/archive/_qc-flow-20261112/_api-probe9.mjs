const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const d = (await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: '全部', limit: 800 }) }).then(r => r.json())).data
console.log('8090 汇总 =', JSON.stringify(d['汇总']))
const html = await fetch(`${BASE}/`).then(r => r.text())
const m = html.match(/index-[A-Za-z0-9_-]+\.js/)
console.log('首页入口 chunk =', m ? m[0] : '(未匹配)')
const qc = [...html.matchAll(/QcFlowMonitor-[A-Za-z0-9_-]+\.(js|css)/g)].map(x => x[0])
console.log('QcFlowMonitor chunk =', [...new Set(qc)].join(', '))
