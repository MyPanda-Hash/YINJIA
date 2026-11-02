/** 在测试库造负库存,用于端到端验证(仅在 HSDZ_MES_TEST) */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = 'HSDZ_MES_TEST'
if (!/TEST/.test(db)) { console.error('只允许在测试库执行'); process.exit(1) }
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

// 直接把这些行设成代表值,绕开约束
await q(`UPDATE kucun SET yl = -5000, rkl = 0, ckl = 5000 WHERE wzdm='YJ-SX-043' AND ckdm='CK00006' AND lot_no IS NULL`)
await q(`UPDATE kucun SET yl = -1200, rkl = 0, ckl = 1200 WHERE wzdm='YJ-JPL-13' AND ckdm='YCL-01' AND lot_no IS NULL`)

console.log('=== 造数后 ===')
const s = await q(`SELECT COUNT(*) n, CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) s FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`)
console.log('负结存:', JSON.stringify(s[0]))
for (const r of await q(`SELECT wzdm, ckdm, ISNULL(lot_no,'(无)') lot, CAST(yl AS decimal(18,2)) yl FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001`))
  console.log('   负: ' + JSON.stringify(r))

// 这两行最后一笔出库日期(决定补单日期)
for (const r of await q(`SELECT RTRIM(物料编码) w, ISNULL(RTRIM(仓库编码),'') c, ISNULL(RTRIM(批号),'') l,
                                MAX(CONVERT(varchar(10),单据日期,120)) lastOut, COUNT(*) n
                           FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 物料编码 IN ('YJ-SX-043','YJ-JPL-13')
                          GROUP BY RTRIM(物料编码), ISNULL(RTRIM(仓库编码),''), ISNULL(RTRIM(批号),'')`))
  console.log('   出库: ' + JSON.stringify(r))
await pool.close()
