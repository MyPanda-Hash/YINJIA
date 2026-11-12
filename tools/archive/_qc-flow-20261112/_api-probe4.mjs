const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const d = (await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: '全部', limit: 800 }) }).then(r => r.json())).data
const verdicts = {}
for (const r of d['行']) verdicts[r['检验结论'] || '(空)'] = (verdicts[r['检验结论'] || '(空)'] || 0) + 1
console.log('检验结论分布 =', JSON.stringify(verdicts))
for (const r of d['行'].filter(x => x['合格数量'] > 0 && x['不合格数量'] > 0).slice(0, 3)) console.log('样例:', r['送料暂收单号'], r['合格数量'], r['不合格数量'], '->', r['检验结论'])
