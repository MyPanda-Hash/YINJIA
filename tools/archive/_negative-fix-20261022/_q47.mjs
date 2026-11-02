/** 特采入库单全清单 + 与「合格品已入库」的重复量核算 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78))

line('① 采购入库单里 特采 字段的全部取值分布')
for (const r of await q(`SELECT ISNULL(特采,'(null)') t, COUNT(*) n, CAST(SUM(实收数量) AS decimal(18,2)) q
                           FROM bl_purchase_in WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(特采,'(null)')`))
  console.log(`   特采=${String(r.t).padEnd(8)} ${String(r.n).padStart(4)} 行  ${String(r.q).padStart(12)}`)

line('② 特采=是 的全部采购入库行')
for (const r of await q(`SELECT l.单据编号, CONVERT(varchar(10),h.单据日期,120) d, l.存货编码, l.存货名称,
                                CAST(l.实收数量 AS decimal(18,2)) 实收, l.特采, l.是否来料检验, l.送检数量,
                                ISNULL(s.shr,'(未审)') 审核, ISNULL(s.canceled,'N') 作废
                           FROM bl_purchase_in l
                           LEFT JOIN bd_purchase_in h ON h.单据编号=l.单据编号
                           LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=l.单据编号
                          WHERE ISNULL(l.asp_cancel,'N')<>'Y' ORDER BY l.id`).then((rows) => rows.filter((x) => x["特采"] === "是")))
  console.log(`   ${String(r.单据编号).padEnd(20)} ${r.d} ${String(r.存货编码 ?? '').padEnd(14)} ${String(r.存货名称 ?? '').padEnd(12)} 实收=${String(r.实收).padStart(8)} 送检=${String(r.送检数量 ?? '-').padStart(6)} 审核=${String(r.审核).padEnd(8)} 作废=${r.作废}`)

line('③ 每条特采链:送检 / 合格 / 不合格 / 特采入 / 重复量')
const tcs = await q(`
  SELECT t.单据编号 tc_no, t.产品名称, t.总数量, t.不合格品数量 bad, t.检验单号,
         (SELECT TOP 1 CAST(d.送检数量 AS decimal(18,2)) FROM qc_insp_detail d WHERE d.单据编号=t.检验单号 AND ISNULL(d.asp_cancel,'N')<>'Y') 送检,
         (SELECT TOP 1 CAST(d.合格数量 AS decimal(18,2)) FROM qc_insp_detail d WHERE d.单据编号=t.检验单号 AND ISNULL(d.asp_cancel,'N')<>'Y') 合格,
         (SELECT TOP 1 CAST(d.不合格数量 AS decimal(18,2)) FROM qc_insp_detail d WHERE d.单据编号=t.检验单号 AND ISNULL(d.asp_cancel,'N')<>'Y') 不合格,
         (SELECT SUM(l.实收数量) FROM form_flow_link f JOIN bl_purchase_in l ON l.单据编号=f.target_form_no
            WHERE f.source_panel_code='QC_TC_IN' AND f.source_form_no=t.单据编号 AND ISNULL(l.asp_cancel,'N')<>'Y') 特采入
    FROM qc_tc_in t WHERE ISNULL(t.asp_cancel,'N')<>'Y' ORDER BY t.单据编号`)
for (const t of tcs) {
  if (t.特采入 == null) continue
  const dup = t.不合格 != null ? Number(t.特采入) - Number(t.不合格) : null
  console.log(`   ${String(t.tc_no).padEnd(20)} ${String(t.产品名称 ?? '').padEnd(12)} 送检=${String(t.送检 ?? '-').padStart(6)} 合格=${String(t.合格 ?? '-').padStart(6)} 不合格=${String(t.不合格 ?? '-').padStart(6)} 特采入=${String(t.特采入).padStart(6)} 多入=${dup === null ? '-' : dup}`)
}

line('④ 特采链的来源检验行,是否同时被普通入库链用掉')
for (const r of await q(`
  SELECT d.单据编号 insp_no, d.物料编码, CAST(d.送检数量 AS decimal(18,2)) 送检, CAST(d.合格数量 AS decimal(18,2)) 合格,
         CAST(d.不合格数量 AS decimal(18,2)) 不合格, ISNULL(d.入库单号,'-') 入库单号,
         (SELECT COUNT(*) FROM form_flow_link f WHERE f.source_panel_code='QC_INSP'
             AND f.source_line_key=CONCAT(d.单据编号,'#',d.id) AND f.target_panel_code='PURCHASE_IN') 普通入库链接,
         (SELECT COUNT(*) FROM form_flow_link f WHERE f.source_panel_code='QC_INSP'
             AND f.source_line_key=CONCAT(d.单据编号,'#',d.id) AND f.target_panel_code='QC_TC_IN') 特采链接
    FROM qc_insp_detail d
   WHERE ISNULL(d.asp_cancel,'N')<>'Y'
     AND EXISTS (SELECT 1 FROM form_flow_link f WHERE f.source_panel_code='QC_INSP'
                  AND f.source_line_key=CONCAT(d.单据编号,'#',d.id) AND f.target_panel_code='QC_TC_IN')
   ORDER BY d.id DESC`))
  console.log(`   ${String(r.insp_no).padEnd(20)} ${String(r.物料编码 ?? '').padEnd(14)} 送检=${String(r.送检).padStart(7)} 合格=${String(r.合格).padStart(7)} 不合格=${String(r.不合格).padStart(7)} 入库单号=${String(r.入库单号).padEnd(20)} 普通入库=${r.普通入库链接} 特采=${r.特采链接}`)
await pool.close()
