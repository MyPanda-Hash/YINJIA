const base = 'http://127.0.0.1:8090/api'
const lg = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const h = { Authorization: 'Bearer ' + lg.data.token }
for (const p of ['OTHER_OUT', 'PURCHASE_IN', 'TRANSFER']) {
  const nf = (await (await fetch(base + '/px/getNewFormPermMatrix?panelCode=' + p, { headers: h })).json()).data
  const g = (nf.buttonGroups || []).find((x) => x.name === '审核')
  console.log(p + ' 审核组 actions = ' + JSON.stringify(g?.actions))
}
