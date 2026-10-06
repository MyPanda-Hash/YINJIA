// 一次性取证探针(只读):ROUTE 明细页签字段定义(参照源/顺序/可见性)
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
const cfg = (await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=ROUTE`, { headers: H })).json())?.data
console.log('metadata.singleDoc =', cfg?.metadata?.singleDoc)
const tabs = cfg?.detail?.tabs || []
for (const t of tabs) {
  console.log(`\n--- tab key=${t.key} label=${t.label} cols=${JSON.stringify(t.cols)}`)
  for (const f of t.fields || []) {
    console.log(JSON.stringify({ n: f.dataName, label: f.label, dt: f.dataType, ref: f.refField, refPanel: f.refPanel, map: f.refMap||f.map, computed: f.computed, hidden: f.hidden, req: f.isRequired, seq: f.seq, trig: f.refTrigger }))
  }
}
