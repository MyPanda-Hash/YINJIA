/** 准备一张可审核的检验单做端到端测试(在测试账套 HSDZ_MES_TEST 造,不碰正式库) */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const db = 'HSDZ_MES_TEST'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 测试库里现有的检验单(可审核状态)===')
for (const r of await q(`SELECT TOP 5 h.单据编号, ISNULL(s.shr,'(未审)') 审核, ISNULL(s.canceled,'N') 作废,
                                (SELECT COUNT(*) FROM qc_insp_detail d WHERE d.单据编号=h.单据编号 AND ISNULL(d.asp_cancel,'N')<>'Y') 行数
                           FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
                          WHERE ISNULL(h.asp_cancel,'N')<>'Y' ORDER BY h.id DESC`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 有「合格>0 且 不合格>0」的检验行(能触发两条链的)===')
for (const r of await q(`SELECT d.单据编号, d.物料编码, CAST(d.合格数量 AS decimal(18,2)) 合格, CAST(d.不合格数量 AS decimal(18,2)) 不合格,
                                CAST(d.送检数量 AS decimal(18,2)) 送检, ISNULL(s.shr,'(未审)') 审核
                           FROM qc_insp_detail d LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=d.单据编号
                          WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.合格数量,0)>0 AND ISNULL(d.不合格数量,0)>0
                          ORDER BY d.id DESC`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== qc_insp / qc_insp_detail 必填列 ===')
for (const t of ['qc_insp', 'qc_insp_detail']) {
  const nn = await q(`SELECT c.name col, ty.name typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                       WHERE c.object_id=OBJECT_ID('${t}') AND c.is_nullable=0 AND c.is_identity=0 ORDER BY c.column_id`)
  console.log(`   ${t}: ` + nn.map((x) => x.col).join(', '))
}
await pool.close()
