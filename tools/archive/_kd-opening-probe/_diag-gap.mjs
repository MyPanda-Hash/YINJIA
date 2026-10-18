/**
 * 诊断:为什么 期初(8/31) + MES 9/1后流水 ≠ 金蝶现存量
 *  对照 金蝶自己的 9/1后收发明细净额 vs MES 9/1后流水净额
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PAGE = 100

async function fetchMonth(ym) {
  const s = `${ym}-01`
  const e = `${ym}-${new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()}`
  const rows = []
  let count = 0
  for (let page = 1; page <= 200; page++) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_detail',
      { page: String(page), page_size: String(PAGE), start_date: s, end_date: e })
    if (!r.ok) break
    count = r.data.count ?? r.data.total
    const rs = r.data.rows || []
    rows.push(...rs)
    if (rs.length < PAGE) break
    await sleep(50)
  }
  return { ym, rows, count }
}
const ms = ['2026-09', '2026-10']
const all = []
for (const m of ms) {
  const r = await fetchMonth(m)
  console.log(`  ${m}: ${r.rows.length}/${r.count}`)
  all.push(...r.rows)
}
// 真实收发(有单据号+仓库)
const real = all.filter((r) => r.bill_no && r.stock_number && (Number(r.in_qty) || Number(r.out_qty)))
const noWh = all.filter((r) => r.bill_no && !r.stock_number && (Number(r.in_qty) || Number(r.out_qty)))
const summary = all.filter((r) => !r.bill_no)
console.log(`\n9-10月明细 ${all.length}:真实收发 ${real.length} · 无仓库收发 ${noWh.length} · 汇总行 ${summary.length}`)
console.log(`  无仓库收发净额 ${noWh.reduce((s, r) => s + Number(r.in_qty || 0) - Number(r.out_qty || 0), 0).toFixed(2)}`)
console.log(`  真实收发净额   ${real.reduce((s, r) => s + Number(r.in_qty || 0) - Number(r.out_qty || 0), 0).toFixed(2)}`)

// 按单据类型统计(依赖 bill_no 前缀)
const byType = new Map()
for (const r of real) {
  const t = String(r.bill_no).replace(/-\d{8}-\d+$/, '')
  const c = byType.get(t) || { n: 0, net: 0 }
  c.n++; c.net += Number(r.in_qty || 0) - Number(r.out_qty || 0)
  byType.set(t, c)
}
console.log('\n按单据号前缀(金蝶 9-10月):')
for (const [t, c] of [...byType.entries()].sort((a, b) => Math.abs(b[1].net) - Math.abs(a[1].net)))
  console.log(`  ${t.padEnd(8)} 行=${String(c.n).padStart(5)} 净额=${c.net.toFixed(2).padStart(14)}`)

// MES 侧同单据类型
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const mesIn = await q(`SELECT 单据类型, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS net FROM inh
   WHERE src BETWEEN 1 AND 8 AND ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
   GROUP BY 单据类型`)
const mesOut = await q(`SELECT 单据类型, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS net FROM outh
   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01' GROUP BY 单据类型`)
console.log('\nMES 侧 9/1后(入库):')
for (const r of mesIn) console.log(`  ${r.单据类型.padEnd(12)} 行=${String(r.n).padStart(5)} 数量=${r.net}`)
console.log('MES 侧 9/1后(出库):')
for (const r of mesOut) console.log(`  ${r.单据类型.padEnd(12)} 行=${String(r.n).padStart(5)} 数量=${r.net}`)
// 金蝶里但 MES 没有的单据类型(按单据号从金蝶明细比)
const kdBills = new Set(real.map((r) => r.bill_no))
const mesBills = new Set((await q(`SELECT 单据编号 FROM inh WHERE 单据类型 <> N'期初结存' AND ISNULL(asp_cancel,'N')<>'Y'
  UNION SELECT 单据编号 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'`)).map((r) => r.单据编号))
let inKdOnly = 0
const inKdOnlyNet = new Map()
for (const r of real) {
  if (!mesBills.has(r.bill_no)) {
    inKdOnly++
    inKdOnlyNet.set(r.bill_no, (inKdOnlyNet.get(r.bill_no) || 0) + Number(r.in_qty || 0) - Number(r.out_qty || 0))
  }
}
console.log(`\n金蝶 9-10月有、MES 里没有的单号:${inKdOnlyNet.size} 张(明细行 ${inKdOnly} 行)`)
const sample = [...inKdOnlyNet.entries()].slice(0, 12)
for (const [no, net] of sample) console.log(`  ${no.padEnd(24)} 净额=${net.toFixed(2)}`)
console.log(`  这些单净额合计 ${[...inKdOnlyNet.values()].reduce((s, v) => s + v, 0).toFixed(2)}`)
await pool.close()
