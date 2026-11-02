/** 查测试库造数为何没生效 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const db = 'HSDZ_MES_TEST'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
console.log('kucun 总量:', JSON.stringify(await q(`SELECT COUNT(*) n FROM kucun`)))
console.log('YJ-SX-043 全部行:')
for (const r of await q(`SELECT * FROM kucun WHERE wzdm='YJ-SX-043'`)) console.log('   ' + JSON.stringify(r))
console.log('yl 最小的 5 行:')
for (const r of await q(`SELECT TOP 5 wzdm, ckdm, lot_no, yl, asp_cancel FROM kucun ORDER BY yl`)) console.log('   ' + JSON.stringify(r))
console.log('TEST-MAT-SEED 的行:', JSON.stringify(await q(`SELECT * FROM kucun WHERE wzdm='TEST-MAT-SEED'`)))
await pool.close()
