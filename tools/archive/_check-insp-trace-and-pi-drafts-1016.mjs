import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== ① 来料检验单的溯源(检验单 → 暂收单 → 采购订单)===')
const tr = await q(`
  SELECT
    COUNT(*) AS 检验单总数,
    SUM(CASE WHEN ISNULL(i.暂收单号,N'') = N'' THEN 1 ELSE 0 END) AS 无暂收单号,
    SUM(CASE WHEN ISNULL(i.暂收单号,N'') <> N'' AND s.单据编号 IS NULL THEN 1 ELSE 0 END) AS 暂收单查不到,
    SUM(CASE WHEN s.单据编号 IS NOT NULL AND (ISNULL(s.采购订单号,N'') = N'' OR o.单据编号 IS NULL) THEN 1 ELSE 0 END) AS 暂收单无来源采购订单,
    SUM(CASE WHEN o.单据编号 IS NOT NULL AND o.单据日期 >= '2026-09-01' THEN 1 ELSE 0 END) AS 追溯到9月1后采购订单,
    SUM(CASE WHEN o.单据编号 IS NOT NULL AND o.单据日期 <  '2026-09-01' THEN 1 ELSE 0 END) AS 追溯到9月1前
  FROM qc_insp i
  LEFT JOIN sl_recv s ON s.单据编号 = i.暂收单号
  LEFT JOIN bd_pu_order o ON o.单据编号 = s.采购订单号`)
console.log('   ' + JSON.stringify(tr[0]))
const bad = await q(`
  SELECT TOP 10 i.单据编号 AS 检验单, ISNULL(i.暂收单号,N'') AS 暂收单, CONVERT(varchar(10), i.单据日期,120) AS 检验单日期,
         ISNULL(s.采购订单号,N'') AS 采购订单, CONVERT(varchar(10), o.单据日期,120) AS 订单日期
  FROM qc_insp i
  LEFT JOIN sl_recv s ON s.单据编号 = i.暂收单号
  LEFT JOIN bd_pu_order o ON o.单据编号 = s.采购订单号
  WHERE o.单据编号 IS NULL OR o.单据日期 < '2026-09-01'
  ORDER BY i.单据日期`)
console.log('   未能追溯到 9/1 后采购订单的样例:')
for (const r of bad) console.log('      ' + JSON.stringify(r))

console.log('=== ② 采购入库单:草稿 / 来源 / 与金蝶同步的重复情况 ===')
const pi = await q(`
  SELECT
    COUNT(*) AS 总单数,
    SUM(CASE WHEN ISNULL(h.来源单据,N'') = N'送料暂收单' THEN 1 ELSE 0 END) AS 来源为送料暂收单,
    SUM(CASE WHEN ISNULL(h.asp_user1,N'') = N'试运行' THEN 1 ELSE 0 END) AS 金蝶同步下来,
    SUM(CASE WHEN ISNULL(h.单据状态,N'') = N'草稿' THEN 1 ELSE 0 END) AS 物理状态草稿
  FROM bd_purchase_in h`)
console.log('   ' + JSON.stringify(pi[0]))
const drafts = await q(`
  SELECT TOP 8 h.单据编号, ISNULL(h.单据状态,N'') AS 物理状态, ISNULL(h.来源单据,N'') AS 来源单据, ISNULL(h.来源单号,N'') AS 来源单号,
         ISNULL(h.asp_user1,N'') AS 落库人, CONVERT(varchar(19), h.asp_time1, 120) AS 创建时间,
         CASE WHEN ISNULL(s.shr,'') <> '' THEN N'已审核' WHEN ISNULL(s.pending,'N') = 'Y' THEN N'审批中' ELSE N'草稿' END AS 派生状态
  FROM bd_purchase_in h
  LEFT JOIN yj_doc_status s ON s.panel_code = 'PURCHASE_IN' AND s.doc_no = h.单据编号
  WHERE ISNULL(h.来源单据,N'') = N'送料暂收单'
  ORDER BY h.id DESC`)
console.log('   来源=送料暂收单 的采购入库单样例:')
for (const r of drafts) console.log('      ' + JSON.stringify(r))
await pool.close()
