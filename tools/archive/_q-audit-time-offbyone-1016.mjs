import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
console.log('=== 来料检验单:单据日期 / 审核时间(列)/ 留痕 shsj / 创建 / 变更 ===')
for (const r of await q(`SELECT TOP 6 i.单据编号, ISNULL(i.单据日期,N'') AS 单据日期, ISNULL(i.审核时间,N'(空)') AS 审核时间列,
    CONVERT(varchar(19), s.shsj, 120) AS 留痕shsj, CONVERT(varchar(19), i.asp_time1, 120) AS 创建, CONVERT(varchar(19), i.asp_time2, 120) AS 变更
  FROM qc_insp i LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号
  WHERE i.单据日期 >= '2026-09-01' ORDER BY i.id DESC`)) console.log('   ' + JSON.stringify(r))
console.log('=== 送料暂收单:同样字段 ===')
for (const r of await q(`SELECT TOP 6 x.单据编号, ISNULL(x.单据日期,N'') AS 单据日期, ISNULL(x.审核时间,N'(空)') AS 审核时间列,
    CONVERT(varchar(19), s.shsj, 120) AS 留痕shsj, CONVERT(varchar(19), x.asp_time1, 120) AS 创建
  FROM sl_recv x LEFT JOIN yj_doc_status s ON s.panel_code='QC_RECV' AND s.doc_no=x.单据编号
  WHERE x.单据日期 >= '2026-09-01' ORDER BY x.id DESC`)) console.log('   ' + JSON.stringify(r))
console.log('=== 统计:审核时间(列)与单据日期差多少天 ===')
for (const r of await q(`SELECT 单据日期, 审核时间, COUNT(*) AS n FROM sl_recv WHERE 审核时间 IS NOT NULL AND 单据日期 >= '2026-09-01' GROUP BY 单据日期, 审核时间 ORDER BY n DESC`)) console.log('   暂收单 ' + JSON.stringify(r))
for (const r of await q(`SELECT 单据日期, 审核时间, COUNT(*) AS n FROM qc_insp WHERE 审核时间 IS NOT NULL AND 单据日期 >= '2026-09-01' GROUP BY 单据日期, 审核时间 ORDER BY n DESC`)) console.log('   检验单 ' + JSON.stringify(r))
await pool.close()
