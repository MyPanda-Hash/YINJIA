/**
 * _q-01-config.mjs — 探针:QC_INSP_REC 物料两列的参照配置现状 + INV 参照行返回键(空值形态)
 * 用法:node tools/archive/_q-qc-insp-rec-material/_q-01-config.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const apiGet = async (u) => (await fetch(BASE + u, { headers: auth })).json()
const apiPost = async (u, b) => (await fetch(BASE + u, { method: 'POST', headers: auth, body: JSON.stringify(b) })).json()

const cfg = await apiGet('/api/px/getPanelConfig?panelCode=QC_INSP_REC')
const fields = cfg?.data?.dataSchema?.fields || []
console.log('== QC_INSP_REC dataSchema 字段(物料两列) ==')
for (const f of fields) {
  if (!['物料名称', '物料编码'].includes(f.code)) continue
  console.log(' ', JSON.stringify(f))
}

const inv = await apiPost('/api/px/queryFormDataList', { panelCode: 'INV', pageNo: 1, pageSize: 2, condition: {} })
const rows = inv?.data?.list || []
console.log(`\n== INV 参照行样本(${rows.length} 行) ==`)
for (const r of rows) {
  console.log('  键数', Object.keys(r).length)
  console.log('  存货编码=', JSON.stringify(r['存货编码']), ' 存货名称=', JSON.stringify(r['存货名称']))
  console.log('  备注=', JSON.stringify(r['备注']), ' 计量单位=', JSON.stringify(r['计量单位']))
  console.log('  机型/规格型号=', JSON.stringify(r['规格型号']))
}
