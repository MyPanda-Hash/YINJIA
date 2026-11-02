/** 清掉我在测试库造的验证数据(seed),恢复原状 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
console.log('清理前:', JSON.stringify((await q(`SELECT COUNT(*) n FROM kucun WHERE ISNULL(yl,0)<-0.0001 AND ISNULL(asp_cancel,'N')<>'Y'`))[0]))
await q(`DELETE FROM kucun WHERE wzdm IN (N'TEST-MAT-SEED')`)
await q(`DELETE FROM inh WHERE 物料编码 = N'TEST-MAT-SEED'`)
await q(`DELETE FROM outh WHERE 物料编码 = N'TEST-MAT-SEED'`)
// 把两条人为造负的行恢复(按流水重算)
await q(`UPDATE kucun SET yl = 0, rkl = 0, ckl = 0 WHERE wzdm IN ('YJ-SX-043','YJ-JPL-13') AND asp_user1='期初导入'`)
console.log('清理后负结存:', JSON.stringify((await q(`SELECT COUNT(*) n FROM kucun WHERE ISNULL(yl,0)<-0.0001 AND ISNULL(asp_cancel,'N')<>'Y'`))[0]))
console.log('TEST-MAT-SEED 残留:', JSON.stringify((await q(`SELECT (SELECT COUNT(*) FROM kucun WHERE wzdm='TEST-MAT-SEED') k, (SELECT COUNT(*) FROM inh WHERE 物料编码='TEST-MAT-SEED') i, (SELECT COUNT(*) FROM outh WHERE 物料编码='TEST-MAT-SEED') o`))[0]))
await pool.close()
