const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then(r => r.json())
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const d = (await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: '未完成', keyword: 'IJ-2026-10-0059', limit: 50 }) }).then(r => r.json())).data
for (const r of d['行']) console.log(JSON.stringify({ 单: r['送料暂收单号'], 检验: r['检验单号'], 合格: r['合格数量'], 不合格: r['不合格数量'], 结论: r['检验结论'], 环节: r['当前环节'] }))
const all = (await fetch(`${BASE}/api/px/qcFlow/list`, { method: 'POST', headers: H, body: JSON.stringify({ 状态: '全部', limit: 800 }) }).then(r => r.json())).data
const v = {}
for (const r of all['行']) v[r['检验结论'] || '(空)'] = (v[r['检验结论'] || '(空)'] || 0) + 1
console.log('测试库 检验结论分布 =', JSON.stringify(v))
