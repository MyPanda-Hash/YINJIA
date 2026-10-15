/* _v-countonly-accept.cjs — 库存报表取数优化验收(只读)
 *   1) INV 计数请求(countOnly)不再搬 4.1MB;行请求仍照常返回全量
 *   2) 三张报表 pageSize 夹到面板配置(50)
 *   3) 台账三段式(期初/期末合成行)口径不变
 */
const BASE = process.env.BASE || 'http://127.0.0.1:8090'
let failed = 0
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) failed++ }

async function post(token, body) {
  const t = Date.now()
  const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
  })
  const txt = await r.text()
  let j = null; try { j = JSON.parse(txt) } catch {}
  return { ms: Date.now() - t, http: r.status, bytes: txt.length, data: j?.data }
}

async function main() {
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const token = (await lr.json())?.data?.token
  if (!token) { console.log('登录失败'); process.exit(1) }
  console.log('[login] ok\n')

  console.log('── 1. 参照行数(INV 商品档案,countOnly)──')
  const c = await post(token, { panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 1, countOnly: true })
  ok('countOnly 返回 totalSize', (c.data?.totalSize || 0) > 0, `totalSize=${c.data?.totalSize}`)
  ok('countOnly 不返回行', (c.data?.list || []).length === 0, `list=${(c.data?.list || []).length}`)
  ok('countOnly 响应体 < 1KB', c.bytes < 1024, `${c.bytes} B(修复前 4,142,327 B)`)
  ok('countOnly < 300ms', c.ms < 300, `${c.ms} ms(修复前 520~700 ms)`)

  const full = await post(token, { panelCode: 'INV', condition: {}, pageNo: 1, pageSize: 1 })
  ok('普通请求仍全量返回档案', (full.data?.list || []).length === 1 && full.bytes > 1000000, `bytes=${full.bytes} totalSize=${full.data?.totalSize}`)

  console.log('\n── 2. 三张报表:每页条数服务端夹取 ──')
  for (const p of ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY']) {
    const a = await post(token, { panelCode: p, condition: {}, pageNo: 1, pageSize: 500, advFilters: [] })
    const n = (a.data?.list || []).length
    ok(`${p} pageSize=500 → 夹到 50`, n <= 50 && n > 0, `rows=${n} totalSize=${a.data?.totalSize} ${a.ms} ms`)
  }
  const b50 = await post(token, { panelCode: 'STOCK_BALANCE', condition: {}, pageNo: 1, pageSize: 50, advFilters: [] })
  ok('STOCK_BALANCE pageSize=50 正常', (b50.data?.list || []).length === 50, `rows=${(b50.data?.list || []).length} 第2页可用=${(b50.data?.totalSize || 0) > 50}`)

  console.log('\n── 3. 台账三段式(期初/期末)口径 ──')
  const cond = { 仓库: '成品B仓', 存货: 'M8x20螺丝', 开始日期: '2026-01-01', 结束日期: '2026-12-31' }
  const p1 = await post(token, { panelCode: 'STOCK_LEDGER', condition: cond, pageNo: 1, pageSize: 50, advFilters: [] })
  const kinds1 = (p1.data?.list || []).map(x => x['单据类型']).filter(Boolean)
  ok('台账条件查询首行=期初结存', kinds1[0] === '期初结存', `首行=${kinds1[0]} totalSize=${p1.data?.totalSize} ${p1.ms} ms`)
  const cond2 = { 仓库: '半成品仓', 存货: '006项目/功能炭棒滤芯', 开始日期: '2026-07-01', 结束日期: '2026-09-30' }
  const q1 = await post(token, { panelCode: 'STOCK_LEDGER', condition: cond2, pageNo: 1, pageSize: 50, advFilters: [] })
  const lastPage = Math.max(1, Math.ceil((q1.data?.totalSize || 0) / 50))
  const ql = lastPage === 1 ? q1 : await post(token, { panelCode: 'STOCK_LEDGER', condition: cond2, pageNo: lastPage, pageSize: 50, advFilters: [] })
  const kindsL = (ql.data?.list || []).map(x => x['单据类型']).filter(Boolean)
  ok('台账末页末行=期末结存', kindsL.at(-1) === '期末结存', `末页${lastPage} 末行=${kindsL.at(-1)} totalSize=${q1.data?.totalSize}`)
  ok('台账条件查询 < 2000ms', q1.ms < 2000, `${q1.ms} ms`)

  console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`)
  process.exitCode = failed === 0 ? 0 : 1
}
main().catch(e => { console.error('探针异常:', e); process.exit(1) })
