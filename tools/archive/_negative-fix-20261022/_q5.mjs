/** 只读探针 ⑤:审核状态口径、单据号规则、其他入库的既有流水 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('yj_doc_status 各面板的审核状态分布')
for (const r of await q(`SELECT panel_code, CASE WHEN ISNULL(shr,'')<>'' THEN N'已审核' ELSE N'未审核' END AS st,
                                COUNT(*) AS n, MIN(shr) AS smin, MAX(shr) AS smax
                           FROM yj_doc_status GROUP BY panel_code, CASE WHEN ISNULL(shr,'')<>'' THEN N'已审核' ELSE N'未审核' END
                          ORDER BY panel_code, st`))
  console.log(`   ${String(r.panel_code).padEnd(16)} ${r.st} ${String(r.n).padStart(5)}  审核人样本 ${r.smin ?? '-'}~${r.smax ?? '-'}`)

line('OTHER_IN 单据的审核状态')
for (const r of await q(`SELECT doc_no, shr, CONVERT(varchar(19),shsj,120) AS shsj, canceled, pending, saved FROM yj_doc_status WHERE panel_code='OTHER_IN' ORDER BY id DESC`))
  console.log(`   ${String(r.doc_no).padEnd(24)} 审核人=${r.shr ?? '(空)'} 时间=${r.shsj ?? '-'} canceled=${r.canceled} pending=${r.pending} saved=${r.saved}`)

line('9-10月 入库单据审核人分布(按面板状态表)')
for (const r of await q(`SELECT panel_code, ISNULL(shr,'(空)') AS shr, COUNT(*) AS n FROM yj_doc_status
                          WHERE doc_no LIKE '%2026%' AND (doc_no LIKE '%202609%' OR doc_no LIKE '%202610%')
                          GROUP BY panel_code, ISNULL(shr,'(空)') ORDER BY panel_code, n DESC`))
  console.log(`   ${String(r.panel_code).padEnd(16)} ${String(r.shr).padEnd(20)} ${r.n}`)

line('s_allno 结构(单据号池)')
for (const r of await q(`SELECT TOP 5 * FROM s_allno`)) console.log('   ' + JSON.stringify(r))
const allnoCols = await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='s_allno' ORDER BY ORDINAL_POSITION`)
console.log('   列: ' + allnoCols.map((x) => x.c).join(', '))

line('其他入库单的既有流水(inh src=3)')
for (const r of await q(`SELECT 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) AS d, 物料编码, 仓库编码, ISNULL(批号,'(null)') AS lot,
                                CAST(数量 AS decimal(18,2)) AS qty, 经手人, asp_user1, 审核 FROM inh WHERE src=3 ORDER BY id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(22)} ${r.d} ${String(r.物料编码).padEnd(16)} ${String(r.仓库编码).padEnd(9)} ${String(r.lot).padEnd(12)} ${String(r.qty).padStart(9)} 记=${r.asp_user1}`)

line('单据号前缀统计(CGRK/QTRK/CPRK 最近编号)')
for (const r of await q(`SELECT TOP 5 单据编号 FROM bd_purchase_in ORDER BY 单据编号 DESC`)) console.log('   CGRK: ' + r.单据编号)
for (const r of await q(`SELECT TOP 5 单据编号 FROM bd_other_in ORDER BY 单据编号 DESC`)) console.log('   QTRK: ' + r.单据编号)
for (const r of await q(`SELECT TOP 5 单据编号 FROM bd_finish_in ORDER BY 单据编号 DESC`)) console.log('   产成品: ' + r.单据编号)

await pool.close()
