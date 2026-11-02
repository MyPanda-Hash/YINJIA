/** ERP导入日志相关表核对 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
console.log('库:', db)

console.log('\n=== 名字含 erp 的表 ===')
for (const r of await q(`SELECT t.name AS tbl, p.[rows] AS nrow
                           FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
                          WHERE t.name LIKE '%erp%' ORDER BY t.name`))
  console.log(`   ${String(r.tbl).padEnd(24)} ${r.nrow} 行`)

console.log('\n=== erp_imp_log 列 ===')
const cols = await q(`SELECT c.name col, ty.name typ, c.max_length len, c.is_nullable nul
                        FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                       WHERE c.object_id=OBJECT_ID('erp_imp_log') ORDER BY c.column_id`)
console.log('   ' + cols.map((x) => `${x.col}:${x.typ}${x.len > 0 && x.typ.includes('char') ? '(' + (x.len / 2) + ')' : ''}`).join('  '))

console.log('\n=== 面板绑定 ===')
for (const r of await q(`SELECT panel_code, panel_name, head_table, line_table FROM yj_panel WHERE panel_code LIKE 'ERPLG%'`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 最近记录(若有)===')
try {
  for (const r of await q(`SELECT TOP 5 * FROM erp_imp_log ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r).slice(0, 400))
} catch (e) { console.log('   ' + e.message) }
await pool.close()
