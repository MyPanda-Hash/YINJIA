import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== 采购入库单:落库人 × 派生状态 ===')
for (const r of await q(`
  SELECT ISNULL(h.asp_user1,N'(空)') AS 落库人,
         CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END AS 派生状态,
         COUNT(*) AS n
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  GROUP BY ISNULL(h.asp_user1,N'(空)'), CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END
  ORDER BY 落库人, 派生状态`)) console.log('   ' + JSON.stringify(r))

console.log('=== 要保留的(金蝶拉下来 = 落库人 试运行) ===')
const keep = await q(`SELECT COUNT(*) AS n FROM bd_purchase_in WHERE asp_user1 = N'试运行'`)
console.log(`   保留 ${keep[0].n} 张`)
console.log('=== 要删除的(其余全部) ===')
const del = await q(`
  SELECT CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核(需先弃审)' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END AS 状态,
         COUNT(*) AS n
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
  WHERE ISNULL(h.asp_user1,N'') <> N'试运行'
  GROUP BY CASE WHEN ISNULL(s.shr,'')<>'' THEN N'已审核(需先弃审)' WHEN ISNULL(s.pending,'N')='Y' THEN N'审批中' ELSE N'草稿' END`)
for (const r of del) console.log('   ' + JSON.stringify(r))
const other = await q(`SELECT TOP 5 单据编号, ISNULL(asp_user1,N'') AS 落库人, ISNULL(来源单据,N'') AS 来源, CONVERT(varchar(10),单据日期,120) AS d FROM bd_purchase_in WHERE ISNULL(asp_user1,N'')<>N'试运行' ORDER BY id`)
console.log('   待删样例:')
for (const r of other) console.log('      ' + JSON.stringify(r))
await pool.close()
