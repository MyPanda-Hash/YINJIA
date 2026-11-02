/** 追一条完整链:检验单 → 采购入库(合格) → 暂收退料 → 特采 → 采购入库(特采) */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('① 检验单 IJ-2026-09-0153 的明细')
for (const r of await q(`SELECT id, 单据编号, 物料编码, 物料名称, CAST(数量 AS decimal(18,2)) 数量, CAST(合格数量 AS decimal(18,2)) 合格,
                                CAST(不合格数量 AS decimal(18,2)) 不合格, CAST(送检数量 AS decimal(18,2)) 送检, 入库单号
                           FROM qc_insp_detail WHERE 单据编号='IJ-2026-09-0153' AND ISNULL(asp_cancel,'N')<>'Y'`))
  console.log('   ' + JSON.stringify(r))

line('② 这条检验链生成的所有流水(检验 → 入库/退料/特采)')
for (const r of await q(`SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status
                           FROM form_flow_link WHERE source_form_no='IJ-2026-09-0153' OR target_form_no='IJ-2026-09-0153'
                           ORDER BY id`))
  console.log('   ' + JSON.stringify(r))

line('③ 该物料 YJ-AJ-017 的所有采购入库行(看是否重复入库)')
for (const r of await q(`SELECT l.单据编号, CONVERT(varchar(10),h.单据日期,120) d, l.存货编码, CAST(l.实收数量 AS decimal(18,2)) 实收,
                                l.特采, ISNULL(l.批号,'(null)') 批号, ISNULL(l.批次号,'(null)') 批次号, h.供应商,
                                ISNULL(l.asp_cancel,'N') canceled
                           FROM bl_purchase_in l LEFT JOIN bd_purchase_in h ON h.单据编号=l.单据编号
                          WHERE l.存货编码='YJ-AJ-017' ORDER BY l.id`))
  console.log(`   ${String(r.单据编号).padEnd(20)} ${r.d} 实收=${String(r.实收).padStart(8)} 特采=${String(r.特采).padEnd(4)} 批号=${String(r.批号).padEnd(12)} canceled=${r.canceled}`)

line('④ 该物料的库存流水')
for (const r of await q(`SELECT 'inh' t, 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) d, CAST(数量 AS decimal(18,2)) q, 仓库编码, ISNULL(批号,'(null)') lot
                           FROM inh WHERE 物料编码='YJ-AJ-017' AND ISNULL(asp_cancel,'N')<>'Y'
                          UNION ALL
                         SELECT 'outh', 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120), CAST(-数量 AS decimal(18,2)), 仓库编码, ISNULL(批号,'(null)')
                           FROM outh WHERE 物料编码='YJ-AJ-017' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY d`))
  console.log(`   [${r.t}] ${String(r.单据编号).padEnd(22)} ${String(r.单据类型).padEnd(10)} ${r.d} ${String(r.q).padStart(9)} ${r.仓库编码} lot=${r.lot}`)

line('⑤ 暂收退料单 TH 明细(特采勾选)')
for (const r of await q(`SELECT id, 单据编号, 物料编码, CAST(送检数量 AS decimal(18,2)) 送检, CAST(退货数量 AS decimal(18,2)) 退货, 特采
                           FROM qc_return_detail WHERE 物料编码='YJ-AJ-017' AND ISNULL(asp_cancel,'N')<>'Y'`))
  console.log('   ' + JSON.stringify(r))
await pool.close()
