import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options:{ encrypt:false, trustServerCertificate:true } })
const q = async (s) => (await pool.request().query(s)).recordset
console.log('=== 现有检验单挂靠的采购订单数 + 批号形态 ===')
console.log('   ' + JSON.stringify((await q("SELECT COUNT(DISTINCT sl.采购订单号) AS 不同采购订单, COUNT(*) AS 检验单, SUM(CASE WHEN ISNULL(i.批次号,N'') LIKE '%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' THEN 1 ELSE 0 END) AS 供应商代码加日期形态, SUM(CASE WHEN ISNULL(i.批次号,N'') LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%' THEN 1 ELSE 0 END) AS 纯日期序号形态 FROM qc_insp i LEFT JOIN sl_recv sl ON sl.单据编号=i.暂收单号 WHERE ISNULL(i.asp_cancel,'N')<>'Y'"))[0]))
console.log('=== 批号形态分布(前 8)===')
for (const r of await q("SELECT TOP 8 LEFT(ISNULL(i.批次号,N'(空)'),12) AS 批号前缀, COUNT(*) AS n FROM qc_insp i WHERE ISNULL(i.asp_cancel,'N')<>'Y' GROUP BY LEFT(ISNULL(i.批次号,N'(空)'),12) ORDER BY n DESC")) console.log('   ' + JSON.stringify(r))
console.log('=== 这些采购订单在 bd_pu_order 里存在吗 + 其商品是否勾来料检验 ===')
console.log('   ' + JSON.stringify((await q("SELECT COUNT(DISTINCT po.单据编号) AS 订单存在, SUM(CASE WHEN EXISTS (SELECT 1 FROM bl_pu_order l JOIN bs_inv iv ON iv.存货编码=l.物料编码 WHERE l.单据编号=po.单据编号 AND ISNULL(iv.来料检验,N'')=N'是') THEN 1 ELSE 0 END) AS 有勾来料检验 FROM bd_pu_order po WHERE po.单据编号 IN (SELECT DISTINCT sl.采购订单号 FROM qc_insp i JOIN sl_recv sl ON sl.单据编号=i.暂收单号)"))[0]))
await pool.close()