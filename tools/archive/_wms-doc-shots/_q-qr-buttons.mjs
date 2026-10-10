/**
 * _q-qr-buttons.mjs — 查 INV / PURCHASE_IN / QC_RECV / FINISH_IN / WHLOC 面板的按钮组与二维码标签元数据
 * 用法: node tools/archive/_wms-doc-shots/_q-qr-buttons.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '') + '/api'
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
for (const pc of ['INV', 'PURCHASE_IN', 'FINISH_IN', 'QC_RECV', 'WHLOC', 'SALE_OUT']) {
  const cfg = await (await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: auth })).json()
  const md = cfg?.data?.metadata || {}
  console.log(`\n== ${pc} ${md.panelName || ''} ==`)
  console.log('  qrLabelKey =', md.qrLabelKey, '| qrLabelKind =', md.qrLabelKind, '| qrLabelScopeKey =', md.qrLabelScopeKey)
  console.log('  panelButtons =', JSON.stringify(md.panelButtons))
  console.log('  buttonGroups =', JSON.stringify((md.buttonGroups || []).map((g) => ({ g: g.group || g.title, actions: g.actions }))))
}
