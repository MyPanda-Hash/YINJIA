/**
 * 生产工单页「日期范围大 ⇒ 卡」的取数成本探针(2026-11-09,只读)
 *
 * 量三件事(全部打现役 8090,不改任何数据):
 *   ① /px/workOrderList 不同日期区间的耗时 / 响应字节 / 行数 —— 看后端取数成本随区间怎么长;
 *   ② /px/scheduleBoard/dayPlan/data 用「全部行id」的耗时 / 响应字节 —— 看前端 load() 第二步的成本;
 *   ③ 前端 refresh 一次的合计载荷(①+②)。
 *
 * 用法: node tools/archive/_wo-daterange-perf-20261109/_probe-api-cost.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LOGIN = { userName: 'admin', password: '123456' }

const t0 = () => performance.now()
const ms = (a, b) => Math.round(b - a)

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(LOGIN), signal: AbortSignal.timeout(15000),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300))
  return j.data.token
}

async function post(token, path, body) {
  const t = t0()
  const r = await fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  const text = await r.text()
  const dt = ms(t, t0())
  let data = null
  try { data = JSON.parse(text) } catch { /* ignore */ }
  return { dt, bytes: Buffer.byteLength(text), code: r.status, rows: Array.isArray(data?.data) ? data.data.length : (Array.isArray(data?.data?.行) ? data.data.行.length : null), json: data }
}

const today = new Date()
const pad = (n) => String(n).padStart(2, '0')
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const shift = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d) }

const token = await login()
console.log('login ok', BASE)

const ranges = [
  ['近15天', { 日期从: shift(-14), 日期到: fmt(today) }],
  ['近30天', { 日期从: shift(-29), 日期到: fmt(today) }],
  ['图1区间(2026-09-02~2026-11-12)', { 日期从: '2026-09-02', 日期到: '2026-11-12' }],
  ['近1年', { 日期从: shift(-364), 日期到: fmt(today) }],
  ['近3年', { 日期从: shift(-1094), 日期到: fmt(today) }],
  ['无日期(全量)', {}],
]
const listResults = []
for (const [name, body] of ranges) {
  const r = await post(token, '/px/workOrderList', body)
  listResults.push({ name, ...r })
  console.log(`[list] ${name.padEnd(20)} ${String(r.dt).padStart(6)}ms  ${(r.bytes / 1024).toFixed(1)}KB  rows=${r.rows}  code=${r.code}`)
}

// ② dayPlan:用「全量」那次返回的行id(前端 load() 第二步就是这么一次全传)
const all = listResults[listResults.length - 1]
const ids = (all.json?.data || []).map((x) => x['行id']).filter((x) => x != null)
console.log(`\n[dayPlan] 全量行id = ${ids.length}`)
for (const n of [30, 100, 200, ids.length]) {
  if (n > ids.length) continue
  const r = await post(token, '/px/scheduleBoard/dayPlan/data', { 行id列表: ids.slice(0, n) })
  console.log(`[dayPlan] ids=${String(n).padEnd(5)} ${String(r.dt).padStart(6)}ms  ${(r.bytes / 1024).toFixed(1)}KB  rows=${r.rows}  code=${r.code}`)
}
