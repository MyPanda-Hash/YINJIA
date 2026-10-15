/* _v-stock-timeout.cjs — 库存报表三面版接口耗时探针(只读)
 * 用法:node tools/archive/_stock-report-timeout/_v-stock-timeout.cjs [pageSize]
 * 前置:后端已在 8090 运行
 */
const BASE = process.env.BASE || 'http://localhost:8090'
const PS = Number(process.argv[2] || 50)
const PANELS = ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_STATUS']

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  const token = lj?.data?.token
  if (!token) { console.log('登录失败:', JSON.stringify(lj).slice(0, 200)); process.exit(1) }
  console.log(`[login] ok  pageSize=${PS}\n`)

  for (const p of PANELS) {
    const t = Date.now()
    let out
    try {
      const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: PS, condition: {}, advFilters: [] }),
        signal: AbortSignal.timeout(300000),
      })
      const j = await r.json().catch(() => null)
      const ms = Date.now() - t
      const bytes = JSON.stringify(j?.data ?? null).length
      out = `HTTP ${r.status}  ${ms} ms  totalSize=${j?.data?.totalSize} rows=${j?.data?.list?.length} jsonBytes=${bytes}`
      if (ms > 15000) out += '   <<< 超前端 15s 线'
    } catch (e) {
      out = `${Date.now() - t} ms  ERR=${e.message}`
    }
    console.log(`${p.padEnd(16)} ${out}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
