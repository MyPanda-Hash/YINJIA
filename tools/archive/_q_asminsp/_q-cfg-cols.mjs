/* 一次性探针:QC_ASM_INSP 明细页签列的真实键名。 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const H = { Authorization: 'Bearer ' + login.data.token }
const cfg = (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=QC_ASM_INSP`, { headers: H }).then((r) => r.json())).data
const tps = cfg.metadata.panelPageDto.tablePages
for (const tp of tps) {
  console.log('tablePage:', tp.tableName, 'gridTabs =', (tp.gridTabs || []).map((g) => g.label + '/' + g.key).join(' , '))
  for (const g of tp.gridTabs || []) {
    console.log(`  --- tab ${g.label || g.key} columns ---`)
    for (const c of g.columns || []) console.log('   ', JSON.stringify(c).slice(0, 220))
  }
}
console.log('\n--- metadata.detail? ---', Object.keys(cfg.metadata).join(','))
if (cfg.metadata.detail) console.log(JSON.stringify(cfg.metadata.detail).slice(0, 1200))
