/**
 * _q-prodline-cols.mjs —— bs_prod_line 有哪几列(造数脚本按实际列名写)(只读)
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const cols = (await pool.request().query(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_prod_line') ORDER BY c.column_id`)).recordset.map((x) => x.name)
console.log('bs_prod_line 列(' + cols.length + '): ' + cols.join(', '))
console.log('有 asp_user1: ' + cols.includes('asp_user1'))
console.log('日产能现状: ' + JSON.stringify((await pool.request().query(`SELECT COUNT(*) AS 总行, SUM(CASE WHEN ISNULL(日产能,0)>0 THEN 1 ELSE 0 END) AS 有值 FROM bs_prod_line`)).recordset[0]))
console.log('各车间日产能: ' + JSON.stringify((await pool.request().query(`SELECT 生产车间, 生产线, 日产能 FROM bs_prod_line WHERE 日产能 IS NOT NULL ORDER BY 生产车间, 生产线`)).recordset))
await pool.close()
