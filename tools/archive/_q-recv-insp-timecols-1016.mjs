import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
for (const t of ['sl_recv', 'qc_insp']) {
  const cols = await q(`SELECT c.name, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
    WHERE c.object_id=OBJECT_ID('${t}') AND (c.name LIKE N'%时间%' OR c.name LIKE N'%日期%' OR c.name LIKE N'%变更%' OR c.name LIKE N'asp_time%')`)
  console.log(`=== ${t} 时间相关列 ===`)
  for (const c of cols) console.log(`   ${c.name}  (${c.typ})`)
  for (const r of await q(`SELECT TOP 3 单据编号, ${cols.map((c) => '[' + c.name + ']').join(', ')} FROM ${t} WHERE 单据日期 >= '2026-09-01' ORDER BY id DESC`)) {
    console.log('   样例 ' + JSON.stringify(r))
  }
}
console.log('=== yj_doc_status 里的时间列 ===')
console.log('   ' + JSON.stringify((await q(`SELECT TOP 2 doc_no, shr, shsj, pending_at, canceled, archived_at FROM yj_doc_status WHERE panel_code IN ('QC_RECV','QC_INSP') ORDER BY id DESC`))))
await pool.close()
