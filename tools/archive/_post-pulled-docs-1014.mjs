/**
 * 拉取单据的「审核 + 记账」(2026-10-14):对 asp_user1='金蝶拉取' 的单据逐张走**真实审核路径**,
 * 由审核钩子触发库存记账(流水 inh/outh + 结存 kucun + 成本重算)。
 *
 * 为什么要走 API 而不是直接写库:记账逻辑(库存守卫、批号口径、成本重算、弃审红冲)全在
 *   ButtonService 审核钩子 → StockLedgerService/StockFlowService 这条链上,直接写库会绕过守卫与口径。
 *
 * **顺序**:按 单据日期 升序;同一天**入库类先于出库类**
 *   (采购入库/产品入库/其他入库 → 生产领料/销售出库/其他出库),
 *   否则出库会因「结存尚为 0」被负库存守卫拦下 —— 这是真实业务顺序的还原。
 *
 * 用法: node tools/archive/_post-pulled-docs-1014.mjs [--db HSDZ_MES_TEST] [--limit N] [--from 2026-09-01]
 * 产物: tools/archive/_dump-out/kingdee-post-<tag>-1014.md(逐单结果 + 失败原因归类)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES_TEST')
const FROM = arg('from', '2026-09-01')
const LIMIT = Number(arg('limit', '0')) || 0
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'
const FACTORY = DB === 'HSDZ_MES' ? undefined : 'YJ_TEST'   // 登录工厂:正式库=默认,测试库=YJ_TEST

// 顺序 = 入账先后(入库先于出库)
const PANELS = [
  { code: 'PURCHASE_IN', head: 'bd_purchase_in', name: '采购入库单', kind: 'in' },
  { code: 'FINISH_IN', head: 'bd_finish_in', name: '产品入库单', kind: 'in' },
  { code: 'OTHER_IN', head: 'bd_other_in', name: '其他入库单', kind: 'in' },
  { code: 'MATERIAL_OUT', head: 'bd_material_out', name: '生产领料单', kind: 'out' },
  { code: 'SALE_OUT', head: 'bd_sale_out', name: '销售出库单', kind: 'out' },
  { code: 'OTHER_OUT', head: 'bd_other_out', name: '其他出库单', kind: 'out' },
]

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

// ① 收集待审核单据(按日期 + 入出库顺序)
const jobs = []
for (const p of PANELS) {
  const rows = (await pool.request().query(
    `SELECT 单据编号, 单据日期 FROM ${p.head} WHERE asp_user1 = N'金蝶拉取' AND 单据日期 >= '${FROM}'`)).recordset
  for (const r of rows) jobs.push({ ...p, no: r.单据编号, date: String(r.单据日期).slice(0, 10) })
}
jobs.sort((a, b) => (a.date === b.date ? (a.kind === b.kind ? a.no.localeCompare(b.no) : (a.kind === 'in' ? -1 : 1)) : a.date.localeCompare(b.date)))
const todo = LIMIT ? jobs.slice(0, LIMIT) : jobs
console.log(`待审核单据 ${todo.length} 张(入账顺序:日期升序,同日入库先于出库)`)

// ② 登录(账套由 factory 决定)
const BASE = 'http://127.0.0.1:8090'
const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', ...(FACTORY ? { factory: FACTORY } : {}) }),
})).json()
if (!login?.data?.token) { console.log('❌ 登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1) }
const token = login.data.token
console.log(`✅ 已登录(账套 ${DB})`)

const call = async (panelCode, buttonName, doc) => {
  const r = await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode, buttonName, formData: { 编号: doc, 单据编号: doc }, buttonParam: {} }),
  })).json()
  const ok = r?.code === 0 || r?.success === true || !!r?.data
  return { ok, msg: r?.data?.message || r?.message || JSON.stringify(r).slice(0, 200) }
}

// ③ 逐张:清掉可能残留的审核留痕 → 提交审批 → 审批通过(记账在审批通过那一步触发)
const ok = [], fail = []
let n = 0
for (const j of todo) {
  n++
  try {
    await pool.request().query(`DELETE FROM yj_doc_status WHERE panel_code = '${j.code}' AND doc_no = N'${j.no.replace(/'/g, "''")}'`)
    const s = await call(j.code, '提交审批', j.no)
    if (!s.ok) { fail.push({ ...j, why: '提交:' + s.msg }); continue }
    const a = await call(j.code, '审批通过', j.no)
    if (a.ok) ok.push(j); else fail.push({ ...j, why: '审核:' + a.msg })
  } catch (e) { fail.push({ ...j, why: '异常:' + String(e.message).slice(0, 120) }) }
  if (n % 50 === 0) console.log(`  ... 已处理 ${n}/${todo.length}(成功 ${ok.length} / 失败 ${fail.length})`)
  await new Promise((r) => setTimeout(r, 60))
}

// ④ 失败原因归类
const bucket = new Map()
for (const f of fail) {
  const key = f.why.replace(/[（(].*?[)）]/g, '').replace(/\d+(\.\d+)?/g, '#').slice(0, 70)
  const cur = bucket.get(key) || { n: 0, sample: [] }
  cur.n++; if (cur.sample.length < 3) cur.sample.push(f.no)
  bucket.set(key, cur)
}
const rep = []
const say = (s) => { rep.push(s); console.log(s) }
say(`# 拉取单据 审核+记账 结果(账套 ${DB})`)
say('')
say(`- 时间:${new Date().toISOString()}  处理 ${todo.length} 张:成功 **${ok.length}** / 失败 **${fail.length}**`)
say('')
say('## 按类型')
say('')
say('| 单据 | 待处理 | 成功 | 失败 |')
say('|---|---|---|---|')
for (const p of PANELS) {
  const t = todo.filter((x) => x.code === p.code).length
  const o = ok.filter((x) => x.code === p.code).length
  if (t) say(`| ${p.name} | ${t} | ${o} | ${t - o} |`)
}
say('')
say('## 失败原因归类')
say('')
say('| 原因 | 张数 | 样例单号 |')
say('|---|---|---|')
for (const [k, v] of [...bucket.entries()].sort((a, b) => b[1].n - a[1].n)) say(`| ${k} | ${v.n} | ${v.sample.join(', ')} |`)
say('')
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL(`./_dump-out/kingdee-post-${TAG}-1014.md`, import.meta.url), rep.join('\n'), 'utf8')
await pool.close()
console.log(`\n成功 ${ok.length} / 失败 ${fail.length}`)
console.log(`[产物] tools/archive/_dump-out/kingdee-post-${TAG}-1014.md`)
