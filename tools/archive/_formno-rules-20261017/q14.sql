SET NOCOUNT ON;
PRINT '== 采购订单 前缀段分布 ==';
SELECT LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) AS pf, COUNT(*) AS n, MIN(单据编号) AS sample
FROM bd_pu_order WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) ORDER BY n DESC;
PRINT '== 销售订单 前缀段分布 ==';
SELECT LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) AS pf, COUNT(*) AS n, MIN(单据编号) AS sample
FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) ORDER BY n DESC;
PRINT '== 销售出库 前缀段分布 ==';
SELECT LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) AS pf, COUNT(*) AS n, MIN(单据编号) AS sample
FROM bd_sale_out WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY LEFT(单据编号, CHARINDEX('-', 单据编号 + '-') - 1) ORDER BY n DESC;
