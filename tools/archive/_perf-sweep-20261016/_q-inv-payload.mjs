/**
 * _q-inv-payload.mjs —— 商品档案取数负载里有多少"面板没登记、保存也用不到"的列(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-inv-payload.mjs [baseUrl] [panel]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = process.argv[3] || 'INV'

const lg = JSON.parse(await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text()).data.token

const res = await fetch(BASE + '/api/px/queryFormDataList', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lg },
  body: JSON.stringify({ panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 50 }),
})
const text = await res.text()
const j = JSON.parse(text)
const rows = (j.data?.list || []).flatMap((r) => Object.values(r.detail || {}).flat())

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const labels = new Set((await pool.request().query(
  `SELECT label FROM yj_field WHERE panel_code = N'${PANEL}'`)).recordset.map((r) => r.label))
await pool.close()

const keys = Object.keys(rows[0] || {})
const unreg = keys.filter((k) => !labels.has(k))
console.log(`== ${PANEL} 取数负载 ==`)
console.log(`  响应 ${(Buffer.byteLength(text) / 1024).toFixed(0)} KB · 明细行 ${rows.length} · 列 ${keys.length}`)
console.log(`  面板已登记(yj_field)字段 ${labels.size} 个`)
console.log(`  **响应里有、面板未登记**的列 ${unreg.length} 个:`)
console.log('    ' + unreg.join(', '))
/* 这些未登记列的字节占比 */
const perRow = new Map(keys.map((k) => [k, 0]))
for (const r of rows) for (const k of keys) perRow.set(k, perRow.get(k) + JSON.stringify(r[k] ?? null).length)
let all = 0, dead = 0
for (const [k, v] of perRow) { all += k.length + v; if (unreg.includes(k)) dead += k.length + v }
console.log(`  未登记列占 JSON 体积 ≈ ${(dead / all * 100).toFixed(1)}%（${(dead / 1024).toFixed(0)} KB / ${(all / 1024).toFixed(0)} KB，按纯 JSON 计）`)
const top = [...perRow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
console.log(`  最占字节的列: ${top.map(([k, v]) => `${k}=${(v / 1024).toFixed(0)}KB`).join('  ')}`)
