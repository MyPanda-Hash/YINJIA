/**
 * _q-08-cfg-after.mjs — 探针:改后 QC_INSP_REC 物料两列下发的参照配置(含 refMap —— 「一并填入」的证据)
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const cfg = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_INSP_REC`, { headers: auth })).json()
for (const f of cfg?.data?.dataSchema?.fields || []) {
  if (!['物料名称', '物料编码'].includes(f.dataName)) continue
  console.log(f.dataName, '=>', JSON.stringify(f))
}
