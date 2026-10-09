/**
 * _q-05-schema.mjs — 探针:dataSchema 字段对象原貌 + INV 参照行是否含 备注/计量单位
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
console.log('schema[0] =', JSON.stringify(schema[0]))
const key = (f) => f.dataName || f.code || f.label || f.name
console.log('全部字段键 =', schema.map(key).join(' | '))
for (const f of schema) if (['物料名称', '物料编码'].includes(key(f))) console.log('  ', JSON.stringify(f))

const inv = await apiPost('/api/px/queryFormDataList', { panelCode: 'INV', pageNo: 1, pageSize: 1, condition: {} })
const rows = inv?.data?.list?.[0]?.detail?.inv || []
const r0 = rows[0] || {}
console.log('\nINV detail.inv 行数 =', rows.length, ' 行键数 =', Object.keys(r0).length)
for (const k of ['存货编码', '存货名称', '备注', '计量单位', '规格型号']) {
  console.log(`  ${k}: 在场=${k in r0} 值=${JSON.stringify(r0[k])}`)
}
console.log('  行键全集 =', Object.keys(r0).join(' | '))
