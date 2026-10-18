const base = 'http://127.0.0.1:8090/api'
const lg = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const token = lg.data?.token
console.log('登录 code=' + lg.code + ' token=' + (token ? 'OK' : 'MISSING'))
const h = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
const post = async (p, b) => (await fetch(base + p, { method: 'POST', headers: h, body: JSON.stringify(b) })).json()
for (const p of ['TRANSFER', 'STOCKTAKE', 'TRANSFER_DETAIL', 'TRANSFER_STATS', 'STOCKTAKE_DETAIL', 'STOCKTAKE_STATS']) {
  const r = await post('/px/queryFormDataList', { panelCode: p, pageNo: 1, pageSize: 3, condition: {} })
  console.log(`${p} -> code=${r.code} rows=${(r.data?.rows || []).length} total=${r.data?.total ?? '-'}`)
}
const cfg = (await (await fetch(base + '/px/getPanelConfig?panelCode=TRANSFER', { headers: h })).json()).data
console.log('TRANSFER 按钮组: ' + (cfg.buttonGroups || []).map((g) => g.name + '(' + (g.actions || []).join('/') + ')').join(' | '))
const nf = (await (await fetch(base + '/px/getNewFormPermMatrix?panelCode=STOCKTAKE', { headers: h })).json()).data
console.log('STOCKTAKE 表头: ' + (nf.meta || []).map((m) => m.name).join(','))
console.log('STOCKTAKE 明细: ' + ((nf.detail?.tabs?.[0]?.fields) || []).map((f) => f.name).join(','))
const nf2 = (await (await fetch(base + '/px/getNewFormPermMatrix?panelCode=TRANSFER', { headers: h })).json()).data
console.log('TRANSFER 明细: ' + ((nf2.detail?.tabs?.[0]?.fields) || []).map((f) => f.name).join(','))
console.log('新建默认值: ' + JSON.stringify(nf2.data))
