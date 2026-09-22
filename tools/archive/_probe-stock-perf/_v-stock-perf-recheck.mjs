const BASE = 'http://localhost:8090/api'
const login = await (await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
const call = async (panel) => { const s = Date.now(); const r = await fetch(BASE + '/px/queryFormDataList', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 20, condition: {} }) }); const b = await r.text(); return { panel, ms: Date.now() - s, bytes: b.length, status: r.status } }
const show = (o) => console.log(`${o.panel.padEnd(14)} ${String(o.ms).padStart(7)}ms  ${String(o.bytes).padStart(8)}B  HTTP ${o.status}`)
console.log('== 串行 3 轮（4 张库存报表 + 参照面板）==')
for (let i = 1; i <= 3; i++) {
  for (const p of ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_STATUS', 'QC_CATALOG', 'QC_INSP_REC']) show(await call(p))
  console.log('  --')
}
console.log('== 并发：4 张报表同时打 + 并发中探 QC 面板 ==')
const s0 = Date.now()
const burst = Promise.all(['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_STATUS'].map(call))
await new Promise(r => setTimeout(r, 50))
const qc = await Promise.all([call('QC_CATALOG'), call('QC_INSP_REC'), call('QC_RECV')])
const res = await burst
res.forEach(show); qc.forEach(show)
console.log(`并发墙钟: ${Date.now() - s0}ms（最慢单次 ${Math.max(...res.map(x => x.ms))}ms）`)
