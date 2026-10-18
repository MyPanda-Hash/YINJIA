/**
 * _q-docstatus-shape.mjs —— yj_doc_status 已审核行 / 待审批行的字段样式(造数照抄)(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-docstatus-shape.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR ${e.message}` } }

console.log('== 已审核行样例(有 shr/shsj 的)==')
for (const r of await q(`SELECT TOP 3 * FROM yj_doc_status WHERE shsj IS NOT NULL ORDER BY shsj DESC`))
  console.log('  ' + JSON.stringify(r))

console.log('\n== 待审批行样例(pending=Y)==')
for (const r of await q(`SELECT TOP 3 * FROM yj_doc_status WHERE pending = 'Y' ORDER BY update_at DESC`))
  console.log('  ' + JSON.stringify(r))

console.log('\n== 按面板统计:审核留痕/待审批 ==')
for (const r of await q(`SELECT panel_code, COUNT(*) AS 行数,
    SUM(CASE WHEN shsj IS NOT NULL THEN 1 ELSE 0 END) AS 已审核,
    SUM(CASE WHEN pending='Y' THEN 1 ELSE 0 END) AS 待审批
  FROM yj_doc_status GROUP BY panel_code ORDER BY COUNT(*) DESC`))
  console.log(`  ${String(r.panel_code).padEnd(18)} ${String(r.行数).padStart(4)} 行  已审核 ${String(r.已审核).padStart(4)}  待审批 ${r.待审批}`)

console.log('\n== 近 30 天有审核留痕的单据(概览"最新动态"就靠这个)==')
for (const r of await q(`SELECT TOP 8 doc_no, panel_code, shr, CONVERT(varchar(19), shsj, 120) AS t FROM yj_doc_status
  WHERE shsj IS NOT NULL AND shsj >= DATEADD(day,-30,CONVERT(date,GETDATE())) ORDER BY shsj DESC`))
  console.log(`  ${String(r.panel_code).padEnd(14)} ${String(r.doc_no).padEnd(20)} ${r.shr} ${r.t}`)
await pool.close()
