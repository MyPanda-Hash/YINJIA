/** bl_purchase_in 实际列 + PI-2026-09-0147 内容 + 重复入库核对 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('bl_purchase_in 列')
console.log('   ' + (await q(`SELECT COLUMN_NAME c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_purchase_in' ORDER BY ORDINAL_POSITION`)).map((x) => x.c).join(', '))

line('PI-2026-09-0147 明细(全列)')
for (const r of await q(`SELECT * FROM bl_purchase_in WHERE 单据编号='PI-2026-09-0147'`))
  console.log('   ' + JSON.stringify(r).slice(0, 700))

line('用户说的「50条」:特采入库行')
for (const r of await q(`SELECT COUNT(DISTINCT l.单据编号) 单据数, COUNT(*) 行数, CAST(SUM(l.实收数量) AS decimal(18,2)) 合计
                           FROM bl_purchase_in l WHERE l.特采=N'是' AND ISNULL(l.asp_cancel,'N')<>'Y'`))
  console.log('   ' + JSON.stringify(r))

line('全部特采单 → 入库单')
for (const r of await q(`
  SELECT t.单据编号 tc_no, t.产品名称, t.总数量, t.不合格品数量 bad, t.检验单号,
         f.target_form_no pi_no, f.link_status
    FROM qc_tc_in t
    LEFT JOIN form_flow_link f ON f.source_panel_code='QC_TC_IN' AND f.source_form_no=t.单据编号
                              AND f.target_panel_code='PURCHASE_IN'
   WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.单据编号`))
  console.log(`   ${String(r.tc_no).padEnd(20)} ${String(r.产品名称 ?? '').padEnd(16)} 总=${String(r.总数量 ?? '-').padEnd(10)} 不合格=${String(r.bad ?? '-').padEnd(5)} → ${String(r.pi_no ?? '(未生成)').padEnd(20)} ${r.link_status ?? ''}`)

line('有不合格的检验行:是否被重复入库(入库链接数 > 1 即重复)')
for (const r of await q(`
  SELECT d.单据编号 insp_no, d.物料编码, CAST(d.送检数量 AS decimal(18,2)) 送检,
         CAST(d.合格数量 AS decimal(18,2)) 合格, CAST(d.不合格数量 AS decimal(18,2)) 不合格,
         d.入库单号,
         (SELECT COUNT(*) FROM form_flow_link f WHERE f.source_panel_code='QC_INSP'
             AND f.source_line_key=CONCAT(d.单据编号,'#',d.id)
             AND f.target_panel_code='PURCHASE_IN' AND f.link_status='ACTIVE') 入库链接
    FROM qc_insp_detail d
   WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(d.不合格数量,0) > 0
   ORDER BY d.id DESC`))
  console.log(`   ${String(r.insp_no).padEnd(20)} ${String(r.物料编码 ?? '').padEnd(14)} 送检=${String(r.送检).padStart(7)} 合格=${String(r.合格).padStart(7)} 不合格=${String(r.不合格).padStart(7)} 入库单号=${String(r.入库单号 ?? '-').padEnd(20)} 链接=${r.入库链接}`)
await pool.close()
