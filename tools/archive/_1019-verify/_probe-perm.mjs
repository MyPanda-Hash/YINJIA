const BASE = 'http://127.0.0.1:8090'
const H = {}
const lr = await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
H.Authorization = 'Bearer ' + lr.data.token
const roles = (await (await fetch(BASE + '/api/sys/role/list', { headers: H })).json()).data || []
const role = roles.find(r => r.roleCode === 'user') || roles[0]
const rj = await (await fetch(`${BASE}/api/sys/role/${role.id}/panels`, { headers: H })).json()
const modules = rj.data.modules || []
const all = modules.flatMap(m => (m.panels || []).map(p => ({ code: p.panelCode, group: m.name })))
const codes = all.map(a => a.code)
const uniq = new Set(codes)
console.log('矩阵行数', codes.length, '唯一', uniq.size)
const dup = codes.filter((c, i) => codes.indexOf(c) !== i)
console.log('重复码', JSON.stringify([...new Set(dup)]))
const PAGE = ['DASHBOARD','SYS_CONSOLE','SYS_ORG','SYS_USAGE','SYS_BACKUP','DC_CONFIG','DC_MONITOR','DC_STATS','BARCODE_SCAN_PICK']
console.log('非 yj_panel + 非已知页面级的码:', JSON.stringify([...uniq].filter(c => !PAGE.includes(c) && c.length < 12)))
