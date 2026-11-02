/** 把退料行勾上「特采」,再重走退料单审核 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const run = (s) => pool.request().query(s)
const q = async (s) => (await run(s)).recordset

const RET = process.argv[2] || 'TH-2026-10-0049'
console.log('退料行(前):')
for (const r of await q(`SELECT id, 物料编码, CAST(退货数量 AS decimal(18,2)) 退货, 特采 FROM qc_return_detail WHERE 单据编号='${RET}'`))
  console.log('   ' + JSON.stringify(r))
await run(`UPDATE qc_return_detail SET 特采 = 1 WHERE 单据编号='${RET}'`)
console.log('退料行(后):')
for (const r of await q(`SELECT id, 物料编码, CAST(退货数量 AS decimal(18,2)) 退货, 特采 FROM qc_return_detail WHERE 单据编号='${RET}'`))
  console.log('   ' + JSON.stringify(r))
await pool.close()
