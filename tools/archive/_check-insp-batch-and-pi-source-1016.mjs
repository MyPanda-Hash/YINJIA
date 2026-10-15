import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 采购入库单清理进度 ===')
console.log('   ' + JSON.stringify((await q(`
  SELECT SUM(CASE WHEN ISNULL(h.asp_user1,N'')=N'试运行' THEN 1 ELSE 0 END) AS 金蝶同步保留,
         SUM(CASE WHEN ISNULL(h.asp_user1,N'')<>N'试运行' AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y' THEN 1 ELSE 0 END) AS 非金蝶残留
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号`))[0]))

console.log('=== 来料检验单:批号 与 来源暂收单批号 是否一致 ===')
console.log('   ' + JSON.stringify((await q(`
  SELECT COUNT(*) AS 检验单,
    SUM(CASE WHEN ISNULL(i.批次号,N'') = ISNULL(sl.批次号,N'') THEN 1 ELSE 0 END) AS 批号一致,
    SUM(CASE WHEN ISNULL(i.批次号,N'') <> ISNULL(sl.批次号,N'') THEN 1 ELSE 0 END) AS 批号不一致,
    SUM(CASE WHEN ISNULL(i.暂收单号,N'') = N'' THEN 1 ELSE 0 END) AS 无暂收单号
  FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号 = i.暂收单号`))[0]))
console.log('   批号不一致样例:')
for (const r of await q(`
  SELECT TOP 5 i.单据编号, CONVERT(varchar(10),i.单据日期,120) AS d, ISNULL(i.批次号,N'(空)') AS 检验单批号,
         ISNULL(i.暂收单号,N'(空)') AS 暂收单, ISNULL(sl.批次号,N'(空)') AS 暂收单批号
  FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号
  WHERE ISNULL(i.批次号,N'') <> ISNULL(sl.批次号,N'')`)) console.log('      ' + JSON.stringify(r))

console.log('=== 采购入库单的来源分布(找"检验单审批自动生成"的那批)===')
for (const r of await q(`
  SELECT ISNULL(h.来源单据,N'(空)') AS 来源, COUNT(*) AS n,
         SUM(CASE WHEN ISNULL(s.canceled,'N')='Y' THEN 1 ELSE 0 END) AS 已软删
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  GROUP BY ISNULL(h.来源单据,N'(空)') ORDER BY n DESC`)) console.log('   ' + JSON.stringify(r))
await pool.close()
