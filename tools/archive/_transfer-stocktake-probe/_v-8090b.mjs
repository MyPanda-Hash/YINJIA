const base = 'http://127.0.0.1:8090/api'
const lg = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const h = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lg.data.token }
const cfg = (await (await fetch(base + '/px/getPanelConfig?panelCode=TRANSFER', { headers: h })).json())
console.log('getPanelConfig 顶层键: ' + Object.keys(cfg.data || {}).join(','))
const d = cfg.data || {}
for (const k of Object.keys(d)) {
  const v = d[k]
  if (Array.isArray(v)) console.log(`  ${k}: array(${v.length})`)
}
const nf = (await (await fetch(base + '/px/getNewFormPermMatrix?panelCode=TRANSFER', { headers: h })).json()).data
console.log('newForm buttonGroups: ' + JSON.stringify((nf.buttonGroups || []).map((g) => ({ n: g.name, a: g.actions }))))
console.log('newForm detail keys: ' + Object.keys(nf.detail || {}))
const tab = nf.detail?.tabs?.[0] || {}
console.log('detail tab keys: ' + Object.keys(tab) + ' | fields[0]=' + JSON.stringify(tab.fields?.[0]))
