/* _v-panel-cfg.cjs — 取库存报表三面版的前端配置(只读) */
const BASE = process.env.BASE || 'http://localhost:8090'
async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json())?.data?.token
  for (const p of ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_STATUS']) {
    const t = Date.now()
    const r = await fetch(`${BASE}/api/px/getPanelConfig?panelCode=${p}`, { headers: { Authorization: `Bearer ${token}` } })
    const txt = await r.text()
    let j = null; try { j = JSON.parse(txt) } catch {}
    const tp = j?.data?.metadata?.panelPageDto?.tablePages?.[0]
    console.log(`${p.padEnd(16)} HTTP ${r.status} ${Date.now() - t}ms bytes=${txt.length} pageSize=${tp?.pageSize} report=${j?.data?.metadata?.report} cat=${j?.data?.metadata?.panelCategory} mode=${j?.data?.metadata?.mode} queryFields=${(tp?.queryFields || []).map(f => f.dataName).join(',')}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
