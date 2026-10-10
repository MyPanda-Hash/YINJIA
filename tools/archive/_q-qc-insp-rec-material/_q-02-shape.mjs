/**
 * _q-02-shape.mjs — 探针:接口原始形态(定位 dataSchema / INV 行键)
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const apiGet = async (u) => (await fetch(BASE + u, { headers: auth })).json()
const apiPost = async (u, b) => (await fetch(BASE + u, { method: 'POST', headers: auth, body: JSON.stringify(b) })).json()

const cfg = await apiGet('/api/px/getPanelConfig?panelCode=QC_INSP_REC')
console.log('cfg 顶层键:', Object.keys(cfg || {}))
console.log('cfg.code=', cfg?.code, ' cfg.data 键=', Object.keys(cfg?.data || {}).slice(0, 20))
console.log('cfg JSON 头 1200:', JSON.stringify(cfg).slice(0, 1200))

const inv = await apiPost('/api/px/queryFormDataList', { panelCode: 'INV', pageNo: 1, pageSize: 2, condition: {} })
console.log('\ninv 顶层键:', Object.keys(inv || {}))
const row = (inv?.data?.list || [])[0]
console.log('inv 首行:', JSON.stringify(row))
