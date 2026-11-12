const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const j = await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: '全部', limit: 800 }) }).then(r => r.json())
const rows = j.data['行'].filter(r => r['检验单号'])
console.log('有检验单的行数:', rows.length)
for (const r of rows.slice(0, 8)) console.log([r['送料暂收单号'], r['物料编码'], r['物料批号'], '检验', r['检验单号'], r['检验状态'], '合格', r['合格数量'], '不良', r['不合格数量'], '结论', r['检验结论'], '入库', r['入库单号'] || '-', r['当前环节']].join(' | '))
const only = await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: '未完成', 仅需检验: true, limit: 800 }) }).then(r => r.json())
console.log('\n仅需检验 汇总:', JSON.stringify(only.data['汇总']))
