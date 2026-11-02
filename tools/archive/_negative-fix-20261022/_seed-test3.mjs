/** 测试库造 1 行负库存,用于验证完整写库路径 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const run = (s) => pool.request().query(s)
await run(`UPDATE kucun SET yl=-700, rkl=0, ckl=700 WHERE wzdm='YJ-SX-043' AND ckdm='CK00006' AND lot_no IS NULL`)
const r = await run(`SELECT COUNT(*) n FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`)
console.log('测试库负结存行数:', r.recordset[0].n)
await pool.close()
