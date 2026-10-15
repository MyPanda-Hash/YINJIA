import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rows = (await pool.request().query(`SELECT * FROM qc_insp WHERE 单据日期 IS NULL`)).recordset
console.log(`空日期检验单 ${rows.length} 张 —— 非空字段:`)
for (const r of rows) {
  const o = {}
  for (const [k, v] of Object.entries(r)) if (v !== null && v !== '' && !/^备用\d+$/.test(k)) o[k] = v
  console.log('   ' + JSON.stringify(o))
}
const st = (await pool.request().query(
  `SELECT panel_code, doc_no, shr, shsj, canceled, archived FROM yj_doc_status
   WHERE panel_code = 'QC_INSP' AND doc_no IN (SELECT 单据编号 FROM qc_insp WHERE 单据日期 IS NULL)`)).recordset
console.log('   对应留痕: ' + JSON.stringify(st))
await pool.close()
