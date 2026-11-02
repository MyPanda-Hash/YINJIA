/** 核实:检验的合格品是否已通过采购入库单入库(排除特采那张) */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n' + '='.repeat(76) + '\n' + t + '\n' + '='.repeat(76))

line('① PP棉 YJ-AJ-017 在 2026-09 的全部采购入库(看合格那 100 从哪进的)')
for (const r of await q(`SELECT l.单据编号, CONVERT(varchar(10),h.单据日期,120) d, CAST(l.实收数量 AS decimal(18,2)) 实收,
                                ISNULL(l.特采,'(null)') 特采, ISNULL(h.采购订单号,'-') 采购订单号, ISNULL(h.匹配来源单号,'-') 匹配来源, ISNULL(h.来源单据,'-') 来源单据,
                                h.供应商
                           FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.单据编号=l.单据编号
                          WHERE l.存货编码='YJ-AJ-017' AND ISNULL(l.asp_cancel,'N')<>'Y'
                          ORDER BY h.单据日期`))
  console.log(`   ${String(r.单据编号).padEnd(20)} ${r.d} 实收=${String(r.实收).padStart(8)} 特采=${String(r.特采).padEnd(6)} PO=${String(r.采购订单号).padEnd(18)} 来源=${r.匹配来源}`)

line('② 送料暂收单 SL-2026-09-0190(PP棉这条链的源头)明细')
for (const r of await q(`SELECT id, 单据编号, 物料编码, CAST(数量 AS decimal(18,2)) 数量, CAST(实收数量 AS decimal(18,2)) 实收, 批号
                           FROM sl_recv_detail WHERE 单据编号='SL-2026-09-0190'`))
  console.log('   ' + JSON.stringify(r))
for (const r of await q(`SELECT 单据编号, 供应商, 采购订单号, 批次号 FROM sl_recv WHERE 单据编号='SL-2026-09-0190'`))
  console.log('   head: ' + JSON.stringify(r))

line('③ 检验单 IJ-2026-09-0153 生成了哪些下游单')
for (const r of await q(`SELECT source_panel_code, target_panel_code, target_form_no, target_line_key, link_status
                           FROM form_flow_link WHERE source_form_no='IJ-2026-09-0153' ORDER BY id`))
  console.log('   ' + JSON.stringify(r))

line('④ 该采购订单号下所有单据')
for (const t of ['bd_purchase_in', 'sl_recv', 'qc_insp']) {
  try {
    const n = await q(`SELECT COUNT(*) c FROM ${t} WHERE 采购订单号='YJ-20260915-06'`)
    console.log(`   ${t}: ${n[0].c} 行`)
  } catch { /* 无该列 */ }
}

line('⑤ 全库:同一物料同日、数量等于「合格数」的采购入库行(找合格品入库踪迹)')
for (const r of await q(`SELECT l.单据编号, CONVERT(varchar(10),h.单据日期,120) d, l.存货编码, CAST(l.实收数量 AS decimal(18,2)) 实收, ISNULL(l.特采,'(null)') 特采
                           FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.单据编号=l.单据编号
                          WHERE ISNULL(l.asp_cancel,'N')<>'Y'
                            AND ((l.存货编码='YJ-AJ-017' AND l.实收数量=100) OR (l.存货编码='Y-S-T' AND l.实收数量=6))
                          ORDER BY h.单据日期`))
  console.log(`   ${String(r.单据编号).padEnd(20)} ${r.d} ${String(r.存货编码).padEnd(12)} 实收=${String(r.实收).padStart(6)} 特采=${r.特采}`)
await pool.close()
