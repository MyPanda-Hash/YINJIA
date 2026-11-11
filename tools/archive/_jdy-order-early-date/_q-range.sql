SET NOCOUNT ON;
PRINT '=== 销售订单 bd_so_order ===';
SELECT COUNT(*) AS 单数, MIN(单据日期) AS 最早单据日期, MAX(单据日期) AS 最晚单据日期,
       MIN(LEFT(创建时间,19)) AS 最早创建时间,
       MAX(LEFT(创建时间,19)) AS 最晚创建时间
FROM bd_so_order;

PRINT '=== 采购订单 bd_pu_order ===';
SELECT COUNT(*) AS 单数, MIN(单据日期) AS 最早单据日期, MAX(单据日期) AS 最晚单据日期,
       MIN(LEFT(创建时间,19)) AS 最早创建时间,
       MAX(LEFT(创建时间,19)) AS 最晚创建时间
FROM bd_pu_order;

PRINT '=== 销售订单按月 ===';
SELECT CONVERT(varchar(7), 单据日期, 120) AS 月份, COUNT(*) AS 单数
FROM bd_so_order GROUP BY CONVERT(varchar(7), 单据日期, 120) ORDER BY 1;

PRINT '=== 采购订单按月 ===';
SELECT CONVERT(varchar(7), 单据日期, 120) AS 月份, COUNT(*) AS 单数
FROM bd_pu_order GROUP BY CONVERT(varchar(7), 单据日期, 120) ORDER BY 1;
