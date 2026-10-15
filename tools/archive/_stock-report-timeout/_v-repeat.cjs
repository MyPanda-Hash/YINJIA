/* _v-repeat.cjs — 同一请求连打多轮,观察库存三面版接口耗时波动 */
const BASE = process.env.BASE || 'http://localhost:8090'
const N = Number(process.argv[2] || 6)
async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json())?.data?.token
  for (const p of ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY']) {
    const times = []
    for (let i = 0; i < N; i++) {
      const t = Date.now()
      const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 50, condition: {}, advFilters: [] }),
        signal: AbortSignal.timeout(300000),
      })
      await r.text()
      times.push(Date.now() - t)
    }
    console.log(`${p.padEnd(16)} ${times.map(x => String(x).padStart(6)).join(' ')}   max=${Math.max(...times)}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
