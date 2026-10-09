/**
 * _q-04-keys2.mjs — 探针:QC_INSP_REC dataSchema 全字段 code + INV list[0] 键
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
const schema = cfg?.data?.dataSchema?.fields || []
console.log('QC_INSP_REC dataSchema.fields code:', schema.map((f) => f.code).join(' | '))
for (const f of schema) if (['物料名称', '物料编码'].includes(f.code)) console.log('  ', JSON.stringify(f))

const inv = await apiPost('/api/px/queryFormDataList', { panelCode: 'INV', pageNo: 1, pageSize: 1, condition: {} })
const l0 = inv?.data?.list?.[0]
console.log('\nINV list[0] 键 =', Object.keys(l0 || {}).join(','))
console.log('INV list[0] 简览 =', JSON.stringify(l0).slice(0, 300))
