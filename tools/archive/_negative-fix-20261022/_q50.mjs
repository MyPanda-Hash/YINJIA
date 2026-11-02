/** PP棉链路溯源(修正列名) */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n' + '='.repeat(76) + '\n' + t + '\n' + '='.repeat(76))

line('① 暂收单 SL-2026-09-0190 明细')
for (const r of await q(`SELECT id, 单据编号, 物料编码, CAST(数量 AS decimal(18,2)) 数量, CAST(入库数量 AS decimal(18,2)) 已入库,
                                ISNULL(入库单号,'-') 入库单号, CAST(ISNULL(剩余数量,0) AS decimal(18,2)) 剩余,
                                CAST(ISNULL(退料数量,0) AS decimal(18,2)) 退料, 批次号, 采购订单行号
                           FROM sl_recv_detail WHERE 单据编号='SL-2026-09-0190'`))
  console.log('   ' + JSON.stringify(r))

line('② 检验单 IJ-2026-09-0153 全部流向')
for (const r of await q(`SELECT source_panel_code src_p, source_line_key src_line, target_panel_code tgt_p, target_form_no tgt_no, link_status
                           FROM form_flow_link
                          WHERE source_form_no='IJ-2026-09-0153' OR source_line_key LIKE 'IJ-2026-09-0153#%'
                             OR target_form_no='IJ-2026-09-0153' ORDER BY id`))
  console.log('   ' + JSON.stringify(r))

line('③ 指向 PI-2026-09-0147 的来源')
for (const r of await q(`SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, link_status
                           FROM form_flow_link WHERE target_form_no='PI-2026-09-0147'`))
  console.log('   ' + JSON.stringify(r))

line('④ PP棉 9/10~9/30 库存流水')
for (const r of await q(`SELECT 'inh' t, 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) d, CAST(数量 AS decimal(18,2)) q, 仓库编码, ISNULL(批号,'(null)') lot
                           FROM inh WHERE 物料编码='YJ-AJ-017' AND 单据日期 BETWEEN '2026-09-10' AND '2026-09-30' AND ISNULL(asp_cancel,'N')<>'Y'
                          UNION ALL
                         SELECT 'outh', 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120), CAST(-数量 AS decimal(18,2)), 仓库编码, ISNULL(批号,'(null)')
                           FROM outh WHERE 物料编码='YJ-AJ-017' AND 单据日期 BETWEEN '2026-09-10' AND '2026-09-30' AND ISNULL(asp_cancel,'N')<>'Y'
                          ORDER BY d`))
  console.log(`   [${r.t}] ${String(r.单据编号).padEnd(22)} ${String(r.单据类型).padEnd(10)} ${r.d} ${String(r.q).padStart(9)} ${r.仓库编码} lot=${r.lot}`)
await pool.close()
