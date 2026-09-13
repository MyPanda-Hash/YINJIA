/**
 * _check-alk-fields.cjs — 通过 API 检查 RD_ALKALINE 字段标签(原始结构)
 */
const API = 'http://localhost:8090/api'
async function main() {
  const lr = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })
  const token = (await lr.json()).data.token
  const r = await fetch(API + '/px/getPanelConfig?panelCode=RD_ALKALINE', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const d = j.data || j
  const fields = d.dataSchema?.fields || d.fields || []
  console.log('TOTAL FIELDS:', fields.length)
  console.log('SAMPLE RAW:', JSON.stringify(fields[0]).slice(0, 300))
  console.log('---all labels---')
  for (const f of fields) console.log(JSON.stringify(f.label ?? f.dataName ?? f.name ?? f))
  console.log('---detail tab---')
  const tab = d.detail?.tabs?.[0]
  if (tab) {
    console.log('TAB RAW FIELD:', JSON.stringify((tab.fields || [])[0]).slice(0, 300))
    for (const f of (tab.fields || [])) console.log(JSON.stringify(f.label ?? f.dataName ?? f.name ?? f))
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
