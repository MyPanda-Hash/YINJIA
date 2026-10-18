/**
 * _q-lazy-scope.mjs —— 「打印层懒渲染」覆盖范围:哪些档案面板的行数超过阈值(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-lazy-scope.mjs [db] [threshold]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const TH = Number(process.argv[3] || 300)
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const panels = (await pool.request().query(
  `SELECT panel_code, ISNULL(panel_name,'') AS panel_name, line_table, ISNULL(page_size,0) AS page_size
     FROM yj_panel WHERE mode = N'archive' AND ISNULL(line_table,'') <> '' ORDER BY panel_code`)).recordset
const rows = []
for (const p of panels) {
  let n = null
  try { n = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${p.line_table}`)).recordset[0].n } catch { /* 视图/表缺失 */ }
  if (n != null) rows.push({ ...p, n })
}
rows.sort((a, b) => b.n - a.n)
console.log(`== ${DB}:档案面板 ${rows.length} 张,阈值 ${TH} 行 ==`)
console.log(`  超过阈值(改后走"按需渲染")${rows.filter((r) => r.n > TH).length} 张:`)
for (const r of rows.filter((r) => r.n > TH)) console.log(`    ${r.panel_code.padEnd(12)} ${String(r.n).padStart(6)} 行  page_size=${r.page_size}  ${r.panel_name}`)
console.log(`  阈值内(照旧常驻渲染)${rows.filter((r) => r.n <= TH).length} 张,最大 ${Math.max(0, ...rows.filter((r) => r.n <= TH).map((r) => r.n))} 行`)
/* 改前每张超阈值面板白建的 DOM 节点量级(行 × 列,jst 估:用 yj_field 登记数近似列数) */
console.log('\n  改前白建的 DOM 量级(≈行 × 登记字段数):')
for (const r of rows.filter((x) => x.n > TH)) {
  const cols = (await pool.request().query(`SELECT COUNT(*) AS n FROM yj_field WHERE panel_code = N'${r.panel_code}'`)).recordset[0].n
  console.log(`    ${r.panel_code.padEnd(12)} ${r.n} × ${cols} ≈ ${(r.n * cols).toLocaleString('en-US')} 个 <td>`)
}
await pool.close()
