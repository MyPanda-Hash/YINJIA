/**
 * _q-03-keys.mjs — 探针:QC_INSP_REC 字段配置 + INV 参照行键(精简输出)
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
const root = cfg?.data ?? cfg
console.log('cfg.data 键 =', Object.keys(root || {}).join(','))
const schema = root?.dataSchema?.fields || []
console.log('dataSchema.fields 数量 =', schema.length)
for (const f of schema) {
  if (!['物料名称', '物料编码'].includes(f.code)) continue
  console.log('  ', f.code, '=>', JSON.stringify(f))
}

const inv = await apiPost('/api/px/queryFormDataList', { panelCode: 'INV', pageNo: 1, pageSize: 1, condition: {} })
const list = inv?.data?.list
console.log('\nINV list 类型 =', Array.isArray(list) ? `数组(${list.length})` : typeof list)
const r0 = Array.isArray(list) ? list[0] : Object.values(inv?.data || {})[0]
console.log('  行键数 =', Object.keys(r0 || {}).length)
for (const k of ['存货编码', '存货名称', '备注', '计量单位', '规格型号']) {
  console.log(`  ${k} = ${JSON.stringify(r0?.[k])}  (在场=${k in (r0 || {})})`)
}
