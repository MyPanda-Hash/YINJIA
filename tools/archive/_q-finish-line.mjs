// _q-finish-line.mjs — 看产成品入库单 getFormDescriptor 的明细形状(一次性)
const BASE = 'http://127.0.0.1:8090'
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) }).then((r) => r.json())
const H = { Authorization: 'Bearer ' + login.data.token }
const r = await fetch(`${BASE}/api/px/getFormDescriptor?panelCode=FINISH_IN&code=FI-2026-10-0005`, { headers: H }).then((x) => x.json())
const d = r.data || {}
console.log('顶层键 =', Object.keys(d).join(','))
console.log('detailData =', JSON.stringify(d.detailData).slice(0, 400))
console.log('detail.tabs =', JSON.stringify((d.detail?.tabs || []).map((t) => ({ key: t.key, n: (t.fields || []).length }))))
const rows = Array.isArray(d.detailData) ? d.detailData : (d.detailData?.detail || Object.values(d.detailData || {})[0] || [])
console.log('行数 =', rows.length)
console.log('首行 =', JSON.stringify(rows[0]))
