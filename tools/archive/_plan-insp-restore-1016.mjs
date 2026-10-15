import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 来料检验单:软删 × 可溯源 ===')
for (const r of await q(`
  SELECT CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已软删(界面不可见)' ELSE N'界面可见' END AS 可见性,
         CASE WHEN o.单据编号 IS NOT NULL AND o.单据日期>='2026-09-01' THEN N'可溯源到9/1后采购订单' ELSE N'不可溯源' END AS 溯源,
         COUNT(*) AS n
  FROM qc_insp i
  LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号
  LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号
  LEFT JOIN bd_pu_order o ON o.单据编号=sl.采购订单号
  GROUP BY CASE WHEN ISNULL(s.canceled,'N')='Y' THEN N'已软删(界面不可见)' ELSE N'界面可见' END,
           CASE WHEN o.单据编号 IS NOT NULL AND o.单据日期>='2026-09-01' THEN N'可溯源到9/1后采购订单' ELSE N'不可溯源' END
  ORDER BY 可见性, 溯源`)) console.log('   ' + JSON.stringify(r))

console.log('=== 检验目录/检验记录 与检验单的对应关系 ===')
for (const r of await q(`
  SELECT
    (SELECT COUNT(*) FROM qc_insp) AS 检验单,
    (SELECT COUNT(*) FROM qc_insp_req) AS 检验项目目录,
    (SELECT COUNT(*) FROM qc_insp_rec) AS 检验数据记录,
    (SELECT COUNT(*) FROM qc_insp_rec_detail) AS 检验记录明细,
    (SELECT COUNT(*) FROM qc_insp_rec r LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP_REC' AND s.doc_no=r.单据编号 WHERE ISNULL(s.canceled,'N')='Y') AS 记录已软删`)) console.log('   ' + JSON.stringify(r[0]))

const sample = await q(`
  SELECT TOP 5 i.单据编号, CONVERT(varchar(10),i.单据日期,120) AS d, ISNULL(i.暂收单号,N'') AS 暂收单, ISNULL(sl.采购订单号,N'') AS 采购订单,
         ISNULL(s.canceled,N'N') AS 软删, ISNULL(s.cancel_by,N'') AS 删者, CONVERT(varchar(19),s.cancel_at,120) AS 删于
  FROM qc_insp i
  LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号
  LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号
  WHERE ISNULL(s.canceled,'N')='Y' ORDER BY i.单据日期`)
console.log('   软删检验单样例:')
for (const r of sample) console.log('      ' + JSON.stringify(r))
await pool.close()
