/** 紧急:负结存从 294 行变 0 行,查清谁动了库 */
import path from 'node:path'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('现在 kucun 的基本面')
for (const r of await q(`SELECT COUNT(*) AS rows_total,
                                SUM(CASE WHEN ISNULL(yl,0)<-0.0001 THEN 1 ELSE 0 END) AS neg,
                                SUM(CASE WHEN ABS(ISNULL(yl,0))<=0.0001 THEN 1 ELSE 0 END) AS zero,
                                SUM(CASE WHEN ISNULL(yl,0)>0.0001 THEN 1 ELSE 0 END) AS pos,
                                CAST(SUM(yl) AS decimal(18,4)) AS total
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)) console.log('   ' + JSON.stringify(r))

line('kucun.asp_user2 最近被谁改过(按时间倒序)')
for (const r of await q(`SELECT TOP 15 ISNULL(asp_user2,'(null)') AS u2, COUNT(*) AS n, MAX(update_date) AS mx
                           FROM kucun GROUP BY ISNULL(asp_user2,'(null)') ORDER BY mx DESC`))
  console.log(`   ${String(r.u2).padEnd(24)} ${String(r.n).padStart(5)} 行  最近 ${r.mx}`)

line('inh / outh / kucun 的最近活动')
for (const r of await q(`SELECT 'inh' AS t, COUNT(*) AS n, MAX(asp_time1) AS mx FROM inh
                          UNION ALL SELECT 'outh', COUNT(*), MAX(asp_time1) FROM outh
                          UNION ALL SELECT 'kucun', COUNT(*), MAX(update_date) FROM kucun
                          UNION ALL SELECT 'yj_usage_log', COUNT(*), MAX(create_time) FROM yj_usage_log`))
  console.log(`   ${String(r.t).padEnd(16)} ${String(r.n).padStart(7)} 行  最近 ${r.mx}`)

line('最近写入的 inh 流水')
for (const r of await q(`SELECT TOP 12 单据编号, 单据类型, src, CONVERT(varchar(19),单据日期,120) AS d, 物料编码, 仓库编码,
                                CAST(数量 AS decimal(18,4)) AS qty, asp_user1, CONVERT(varchar(19),asp_time1,120) AS t1
                           FROM inh ORDER BY id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(24)} ${String(r.单据类型).padEnd(10)} src=${r.src} ${String(r.d).padEnd(20)} ${String(r.物料编码).padEnd(15)} ${String(r.仓库编码).padEnd(9)} ${String(r.qty).padStart(10)} by=${r.asp_user1} @${r.t1}`)

line('最近写入的 outh 流水')
for (const r of await q(`SELECT TOP 12 单据编号, 单据类型, src, CONVERT(varchar(19),单据日期,120) AS d, 物料编码, 仓库编码,
                                CAST(数量 AS decimal(18,4)) AS qty, asp_user1, CONVERT(varchar(19),asp_time1,120) AS t1
                           FROM outh ORDER BY id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(24)} ${String(r.单据类型).padEnd(10)} src=${r.src} ${String(r.d).padEnd(20)} ${String(r.物料编码).padEnd(15)} ${String(r.仓库编码).padEnd(9)} ${String(r.qty).padStart(10)} by=${r.asp_user1} @${r.t1}`)

line('是否出现我脚本口径的配平单')
for (const r of await q(`SELECT 单据编号, 备注, 审核人, 创建时间 FROM bd_other_in ORDER BY id DESC`))
  console.log('   ' + JSON.stringify(r))

line('yj_usage_log 列')
for (const r of await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_usage_log' ORDER BY ORDINAL_POSITION`))
  process.stdout.write(r.c + ' ')
console.log('')

line('yj_usage_log 最近记录')
for (const r of await q(`SELECT TOP 15 * FROM yj_usage_log ORDER BY id DESC`)) console.log('   ' + JSON.stringify(r).slice(0, 300))

await pool.close()
