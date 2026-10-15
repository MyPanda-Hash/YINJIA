import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options:{ encrypt:false, trustServerCertificate:true } })
const q = async (s) => (await pool.request().query(s)).recordset
console.log('=== 我生成的 8 张检验单:批号链路 ===')
for (const r of await q("SELECT i.单据编号 AS 检验单, ISNULL(i.批次号,N'(空)') AS 检验单批号, ISNULL(i.暂收单号,N'') AS 暂收单, ISNULL(sl.批次号,N'(空)') AS 暂收单批号, ISNULL(sl.采购订单号,N'') AS 采购订单, ISNULL(o.批次号,N'(空)') AS 采购订单批号 FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号 LEFT JOIN bd_pu_order o ON o.单据编号=sl.采购订单号 WHERE i.单据编号 LIKE 'IJ-2026-10-%' ORDER BY i.单据编号")) console.log('   ' + JSON.stringify(r))
console.log('=== 金蝶同步的采购入库单批号样例 ===')
for (const r of await q("SELECT TOP 5 单据编号, ISNULL(批次号,N'(空)') AS 头批次 FROM bd_purchase_in WHERE asp_user1=N'试运行' ORDER BY id")) console.log('   ' + JSON.stringify(r))
console.log('=== 暂收单批号样例(我生成的)===')
for (const r of await q("SELECT TOP 6 单据编号, ISNULL(批次号,N'(空)') AS 批次号, ISNULL(采购订单号,N'') AS 采购订单 FROM sl_recv WHERE 单据编号 LIKE 'SL-2026-10-%' ORDER BY 单据编号")) console.log('   ' + JSON.stringify(r))
await pool.close()