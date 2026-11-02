/** 只读探针 ⑨:SUBSCRIBE 留痕来源 + 现有单据号池 + 9/10 月审核时间口径 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('yj_form_approval action 分布')
for (const r of await q(`SELECT action, result, COUNT(*) AS n FROM yj_form_approval GROUP BY action, result ORDER BY n DESC`))
  console.log(`   ${String(r.action).padEnd(16)} ${String(r.result).padEnd(12)} ${r.n}`)

line('9-10 月 OTHER_IN 原单日期 vs 审核时间')
for (const r of await q(`SELECT h.单据编号, CONVERT(varchar(10),h.单据日期,120) AS d, s.shr, CONVERT(varchar(19),s.shsj,120) AS shsj
                           FROM bd_other_in h LEFT JOIN yj_doc_status s ON s.panel_code='OTHER_IN' AND s.doc_no=h.单据编号
                          ORDER BY h.单据日期`))
  console.log(`   ${String(r.单据编号).padEnd(22)} 日期=${r.d} 审核人=${String(r.shr).padEnd(8)} 审核时间=${r.shsj}`)

line('s_allno QTRK 记录')
for (const r of await q(`SELECT COUNT(*) n FROM s_allno WHERE dh LIKE 'QTRK%'`)) console.log('   ' + r.n)

line('其他入库单头样例:业务类型/供应商')
for (const r of await q(`SELECT 单据编号, 业务类型, 业务类型编码, 业务类型id, 供应商编码, 供应商, 经手人, 部门, 单据状态, 创建人 FROM bd_other_in ORDER BY id DESC`))
  console.log('   ' + JSON.stringify(r))

line('CGRK/CPRK 审核人是否为 admin')
for (const r of await q(`SELECT panel_code, ISNULL(shr,'(空)') AS shr, COUNT(*) n FROM yj_doc_status WHERE panel_code IN ('PURCHASE_IN','FINISH_IN','TRANSFER') AND doc_no LIKE '%202610%' GROUP BY panel_code, ISNULL(shr,'(空)')`))
  console.log(`   ${String(r.panel_code).padEnd(14)} ${String(r.shr).padEnd(10)} ${r.n}`)

await pool.close()
