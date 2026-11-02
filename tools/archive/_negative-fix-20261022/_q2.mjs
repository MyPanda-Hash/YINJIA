/** 只读探针 ②:负结存形态 + 已有入库单的审核人/审核标记口径 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('负结存按物料汇总 Top15')
for (const r of await q(`SELECT TOP 15 wzdm, COUNT(*) AS n, CAST(SUM(yl) AS decimal(18,2)) AS s
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001
                          GROUP BY wzdm ORDER BY s`))
  console.log(`   ${String(r.wzdm).padEnd(16)} ${String(r.n).padStart(4)} 行  ${String(r.s).padStart(12)}`)

line('负结存行样例(20)')
for (const r of await q(`SELECT TOP 20 wzdm, ckdm, ISNULL(lot_no,'(null)') AS lot, CAST(yl AS decimal(18,2)) AS yl,
                                CONVERT(varchar(10),in_date,120) AS in_d, ISNULL(price,0) AS price
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001 ORDER BY yl`))
  console.log(`   ${String(r.wzdm).padEnd(14)} ${String(r.ckdm).padEnd(10)} lot=${String(r.lot).padEnd(18)} yl=${String(r.yl).padStart(10)} in=${r.in_d} price=${r.price}`)

line('同物料同仓合计>0 的假负行数')
for (const r of await q(`SELECT COUNT(*) AS fake FROM (
      SELECT k.wzdm,k.ckdm,SUM(y.yl) AS tot FROM kucun k JOIN kucun y ON y.wzdm=k.wzdm AND y.ckdm=k.ckdm AND ISNULL(y.asp_cancel,'N')<>'Y'
       WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND ISNULL(k.yl,0)<-0.0001 GROUP BY k.wzdm,k.ckdm) z WHERE tot > 0.0001`))
  console.log(`   假负 ${r.fake} 行`)

line('已有入库单的审核口径(按单据类型)')
for (const r of await q(`SELECT 单据类型 AS t, ISNULL(审核,'(null)') AS shen, COUNT(*) AS n,
                                MIN(ISNULL(asp_user2,'(null)')) AS u2min, MAX(ISNULL(asp_user2,'(null)')) AS u2max,
                                MIN(ISNULL(asp_user1,'(null)')) AS u1min, MAX(ISNULL(asp_user1,'(null)')) AS u1max,
                                MIN(ISNULL(经手人,'(null)')) AS jmin, MAX(ISNULL(经手人,'(null)')) AS jmax
                           FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 3
                          GROUP BY 单据类型, 审核 ORDER BY n DESC`))
  console.log(`   ${String(r.t).padEnd(12)} 审核=${String(r.shen).padEnd(8)} ${String(r.n).padStart(5)}行  人1=${r.u1min}~${r.u1max}  审核人=${r.u2min}~${r.u2max}  经手人=${r.jmin}~${r.jmax}`)

line('9-10 月各入库单据的审核时间/单号样例(10)')
for (const r of await q(`SELECT TOP 10 单据编号, 单据类型, CONVERT(varchar(19),单据日期,120) AS d,
                                asp_user1, CONVERT(varchar(19),asp_time1,120) AS t1,
                                asp_user2, CONVERT(varchar(19),asp_time2,120) AS t2, 审核, 经手人, src
                           FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 3 ORDER BY 单据日期 DESC`))
  console.log(`   ${r.单据编号} ${r.单据类型} 日期=${r.d} 制=${r.asp_user1}@${r.t1} 审=${r.asp_user2}@${r.t2} 审核标记=${r.审核} 经手人=${r.经手人} src=${r.src}`)

line('单据编号规则样例')
for (const r of await q(`SELECT TOP 12 单据编号, 单据类型, rid, src FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>='2026-09-01' ORDER BY 单据日期 DESC`))
  console.log(`   ${String(r.单据编号).padEnd(24)} ${String(r.单据类型).padEnd(10)} rid=${r.rid} src=${r.src}`)

await pool.close()
