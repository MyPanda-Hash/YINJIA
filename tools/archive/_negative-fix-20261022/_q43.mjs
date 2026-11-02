/** 特采单 → 采购入库单 的数量口径实证 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 特采单总数(最近 10 张)===')
for (const r of await q(`SELECT TOP 10 单据编号, 产品名称, 总数量, 不合格品数量, 不合格品比例, 检验单号, 暂收退料单号
                           FROM qc_tc_in WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(22)} ${String(r.产品名称 ?? '').padEnd(18)} 总数量=${String(r.总数量).padEnd(12)} 不合格量=${String(r.不合格品数量 ?? '-').padEnd(8)} 比例=${String(r.不合格品比例 ?? '-')}`)

console.log('\n=== 特采链路(form_flow_link QC_TC_IN → PURCHASE_IN)===')
for (const r of await q(`SELECT source_form_no, target_form_no, link_status FROM form_flow_link
                          WHERE source_panel_code='QC_TC_IN' AND target_panel_code='PURCHASE_IN' ORDER BY id DESC`))
  console.log('   ' + JSON.stringify(r))

console.log('\n=== 特采生成的入库单(行上 特采=是)===')
for (const r of await q(`SELECT TOP 10 l.单据编号, l.存货编码, l.存货名称, CAST(l.实收数量 AS decimal(18,2)) 实收,
                                l.特采, h.供应商
                           FROM bl_purchase_in l JOIN bd_purchase_in h ON h.单据编号=l.单据编号
                          WHERE l.特采=N'是' AND ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(22)} ${String(r.存货编码 ?? '').padEnd(14)} 实收=${String(r.实收).padStart(10)} 特采=${r.特采}`)

console.log('\n=== 对照:来源检验行的 送检/合格/不合格 ===')
for (const r of await q(`SELECT TOP 10 d.单据编号, d.物料编码, CAST(d.数量 AS decimal(18,2)) 数量,
                                CAST(d.合格数量 AS decimal(18,2)) 合格, CAST(d.不合格数量 AS decimal(18,2)) 不合格,
                                CAST(d.送检数量 AS decimal(18,2)) 送检
                           FROM qc_insp_detail d WHERE ISNULL(d.asp_cancel,'N')<>'Y'
                            AND d.单据编号 IN (SELECT 检验单号 FROM qc_tc_in WHERE ISNULL(检验单号,'')<>'')
                          ORDER BY d.id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(20)} ${String(r.物料编码 ?? '').padEnd(14)} 送检=${String(r.送检).padStart(8)} 合格=${String(r.合格).padStart(8)} 不合格=${String(r.不合格).padStart(8)} 数量=${String(r.数量).padStart(8)}`)

console.log('=== 暂收退料行(特采=1)===')
for (const r of await q(`SELECT TOP 10 单据编号, 物料编码, CAST(送检数量 AS decimal(18,2)) 送检, CAST(退货数量 AS decimal(18,2)) 退货, 特采
                           FROM qc_return_detail WHERE ISNULL(特采,0)=1 AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`))
  console.log(`   ${String(r.单据编号).padEnd(22)} ${String(r.物料编码 ?? '').padEnd(14)} 送检=${String(r.送检).padStart(8)} 退货=${String(r.退货).padStart(8)}`)
await pool.close()
