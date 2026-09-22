/* _v-stock-api-perf.cjs — 库存报表性能修复的接口级验收探针(只读)
 *
 * 验收口径(任务单 §四):
 *   1) 4 个库存报表面板 queryFormDataList(取 20 行) 均 < 2000 ms
 *   2) 与库存无关的面板(检验链) 仍 < 500 ms,不出现 15 s 超时
 *   3) 并发:3 个面板并发各打一次,总耗时与串行相当且无超时
 *
 * 用法:node tools/archive/_probe-stock-perf/_v-stock-api-perf.cjs
 * 前置:后端已在 8090 运行(本机:java -jar backend\target\yinjia-mes-backend-0.1.0.jar)
 * 退出码:0=全过, 1=有 FAIL
 */
const BASE = 'http://localhost:8090'
const STOCK = ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'STOCK_STATUS']
const OTHER = ['QC_CATALOG', 'QC_INSP_REC']
const LIMIT_STOCK = 2000
const LIMIT_OTHER = 500

const sleep = ms => new Promise(r => setTimeout(r, ms))
let failed = 0
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) failed++
}

/** 打一次 queryFormDataList,返回 {ms, totalSize, err} */
async function query(token, panelCode, pageSize = 20) {
  const t = Date.now()
  try {
    const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode, pageNo: 1, pageSize, condition: {}, advFilters: [] }),
      signal: AbortSignal.timeout(30000),
    })
    const j = await r.json().catch(() => null)
    const ms = Date.now() - t
    if (!r.ok || (j && j.code && j.code !== 0 && j.code !== 200)) {
      return { ms, err: `HTTP ${r.status} ${j ? JSON.stringify(j).slice(0, 160) : ''}` }
    }
    return { ms, totalSize: j?.data?.totalSize, rows: j?.data?.list?.length }
  } catch (e) {
    return { ms: Date.now() - t, err: String(e.message || e) }
  }
}

async function main() {
  // 登录(与既有探针同口径)
  const lr = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const lj = await lr.json()
  const token = lj?.data?.token
  if (!token) { console.log('FAIL  登录失败:', JSON.stringify(lj).slice(0, 200)); process.exit(1) }
  console.log(`[login] ok  user=${lj?.data?.user?.userName ?? '?'}\n`)

  // ── 1. 串行:4 个库存报表面板 ──
  console.log('── 1. 串行 · 4 个库存报表面板(取 20 行) ──')
  for (const p of STOCK) {
    const r = await query(token, p)
    if (r.err) { ok(`${p}`, false, r.err); continue }
    ok(`${p} < ${LIMIT_STOCK}ms`, r.ms < LIMIT_STOCK, `${r.ms} ms · totalSize=${r.totalSize} rows=${r.rows}`)
    await sleep(200)
  }

  // ── 2. 串行:无关面板(检验链) ──
  console.log('\n── 2. 串行 · 无关面板(检验链,库空闲时应远低于阈值) ──')
  for (const p of OTHER) {
    const r = await query(token, p)
    if (r.err) { ok(`${p}`, false, r.err); continue }
    ok(`${p} < ${LIMIT_OTHER}ms`, r.ms < LIMIT_OTHER, `${r.ms} ms · totalSize=${r.totalSize} rows=${r.rows}`)
    await sleep(200)
  }

  // ── 3. 并发:3 个库存面板 + 1 个无关面板同时打 ──
  //    判据:并发总耗时应与其中最慢的单次相当(不出现串行排队式的翻倍),且无关面板不被拖垮。
  console.log('\n── 3. 并发 · 3 库存 + 1 无关 同时发起 ──')
  const conc = ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY', 'QC_CATALOG']
  const t0 = Date.now()
  const rs = await Promise.all(conc.map(p => query(token, p)))
  const wall = Date.now() - t0
  conc.forEach((p, i) => {
    const r = rs[i]
    if (r.err) { ok(`并发 ${p}`, false, r.err); return }
    const lim = STOCK.includes(p) ? LIMIT_STOCK : LIMIT_OTHER
    ok(`并发 ${p} < ${lim}ms`, r.ms < lim, `${r.ms} ms`)
  })
  const slowest = Math.max(...rs.map(r => r.ms))
  // 并发墙钟时间不应显著超过最慢者(超时/排队会体现为远超)
  ok(`并发总耗时 ≈ 最慢单次`, wall < slowest + 1500, `wall=${wall} ms · slowest=${slowest} ms`)
  ok(`并发无 15s 超时`, rs.every(r => !r.err), rs.filter(r => r.err).map(r => r.err).join(' | ') || 'none')

  // ── 4. 台账条件路径:仓库/存货/日期段四项齐全时才触发的「期初/期末」两条附加 SQL
  //    (它们同样带了 OPTION (RECOMPILE),必须单独回归,否则只在用户填满查询弹窗时才暴露)
  //    口径:期初行只在 pageNo==1 出现,期末行只在 pageNo==lastPage 出现。
  console.log('\n── 4. 台账条件路径(期初/期末合成行 + 带 hint 的附加 SQL) ──')
  const cond = { 仓库: '半成品仓', 存货: '006项目/功能炭棒滤芯', 开始日期: '2026-07-01', 结束日期: '2026-09-30' }
  const pageOf = async (pageNo) => {
    const t = Date.now()
    const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: 'STOCK_LEDGER', pageNo, pageSize: 20, condition: cond, advFilters: [] }),
      signal: AbortSignal.timeout(30000),
    })
    const j = await r.json().catch(() => null)
    return { ms: Date.now() - t, http: r.status, size: j?.data?.totalSize, list: j?.data?.list || [] }
  }
  const p1 = await pageOf(1)
  const lastPage = Math.max(1, Math.ceil((p1.size || 0) / 20))
  const pLast = lastPage === 1 ? p1 : await pageOf(lastPage)
  const kinds = (p) => p.list.map(x => x['单据类型']).filter(Boolean)
  ok('台账条件查询 < 2000ms', p1.ms < LIMIT_STOCK, `page1=${p1.ms} ms page${lastPage}=${pLast.ms} ms totalSize=${p1.size}`)
  ok('首行=期初结存', kinds(p1)[0] === '期初结存', `首行=${kinds(p1)[0]}`)
  ok('末页末行=期末结存', kinds(pLast).at(-1) === '期末结存', `末页${lastPage} 末行=${kinds(pLast).at(-1)}`)

  console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILED'}`)
  process.exitCode = failed === 0 ? 0 : 1
}

main().catch(e => { console.error('探针异常:', e); process.exit(1) })
