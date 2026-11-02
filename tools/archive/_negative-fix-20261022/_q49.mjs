/** PP棉链路的完整溯源:暂收 200 → 检验 100合格/100不合格 → 特采入库 200,合格品有没有单独入过 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n' + '='.repeat(76) + '\n' + t + '\n' + '='.repeat(76))

line('① 暂收单 SL-2026-09-0190 明细')
console.log('   列: ' + (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv_detail' ORDER BY ORDINAL_POSITION`)).map((x) => x.c).join(', '))
for (const r of await q(`SELECT id, 单据编号, ISNULL(物料编码,'') 物料编码, CAST(数量 AS decimal(18,2)) 数量, CAST(实收数量 AS decimal(18,2)) 实收
                           FROM sl_recv_detail WHERE 单据编号='SL-2026-09-0190'`)) console.log('   ' + JSON.stringify(r))

line('② 检验单 IJ-2026-09-0153 的全部下游(含 RELEASED)')
for (const r of await q(`SELECT source_panel_code src_p, source_form_no src_no, source_line_key src_line,
                                target_panel_code tgt_p, target_form_no tgt_no, link_status
                           FROM form_flow_link
                          WHERE source_form_no='IJ-2026-09-0153'
                             OR target_form_no='IJ-2026-09-0153'
                             OR target_line_key LIKE 'IJ-2026-09-0153#%'
                             OR source_line_key LIKE 'IJ-2026-09-0153#%' ORDER BY id`))
  console.log('   ' + JSON.stringify(r))

line('③ 反查:谁指向 PI-2026-09-0147')
for (const r of await q(`SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, link_status
                           FROM form_flow_link WHERE target_form_no='PI-2026-09-0147'`))
  console.log('   ' + JSON.stringify(r))

line('④ PP棉该批次在 9/15~9/24 期间的库存流水(看实际进了多少)')
for (const r of await q(`SELECT 'inh' t, 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) d, CAST(数量 AS decimal(18,2)) q, 仓库编码, ISNULL(批号,'(null)') lot, asp_user1
                           FROM inh WHERE 物料编码='YJ-AJ-017' AND 单据日期 BETWEEN '2026-09-10' AND '2026-09-30' AND ISNULL(asp_cancel,'N')<>'Y'
                          UNION ALL
                         SELECT 'outh', 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120), CAST(-数量 AS decimal(18,2)), 仓库编码, ISNULL(批号,'(null)'), asp_user1
                           FROM outh WHERE 物料编码='YJ-AJ-017' AND 单据日期 BETWEEN '2026-09-10' AND '2026-09-30' AND ISNULL(asp_cancel,'N')<>'Y'
                          ORDER BY d`))
  console.log(`   [${r.t}] ${String(r.单据编号).padEnd(22)} ${String(r.单据类型).padEnd(10)} ${r.d} ${String(r.q).padStart(9)} ${r.仓库编码} lot=${String(r.lot).padEnd(12)} by=${r.asp_user1}`)

line('⑤ 全库统计:特采链「送检」vs「特采入库」是否相等(相等=整批只入一次)')
for (const r of await q(`
  SELECT SUM(CAST(d.送检数量 AS decimal(18,2))) 送检合计, SUM(CAST(d.合格数量 AS decimal(18,2))) 合格合计,
         SUM(CAST(ISNULL(d.不合格数量,0) AS decimal(18,2))) 不合格合计
    FROM qc_insp_detail d
   WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND EXISTS (SELECT 1 FROM form_flow_link f WHERE f.source_panel_code='QC_INSP'
            AND f.source_line_key=CONCAT(d.单据编号,'#',d.id) AND f.target_panel_code='QC_TC_IN' AND f.link_status='ACTIVE')`))
  console.log('   ' + JSON.stringify(r[0]))
await pool.close()
