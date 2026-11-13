SET NOCOUNT ON;
PRINT '=== bd_so_order 概况 ===';
SELECT 单据状态, asp_cancel, COUNT(*) AS 行数,
       SUM(CASE WHEN 外部数据ID IS NULL THEN 1 ELSE 0 END) AS 无外部ID,
       MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚,
       MIN(CONVERT(varchar(19),asp_time1,120)) AS 最早写入, MAX(CONVERT(varchar(19),asp_time1,120)) AS 最晚写入
FROM bd_so_order GROUP BY 单据状态, asp_cancel ORDER BY 行数 DESC;

PRINT '=== bd_so_order 写入批次(按写入日) ===';
SELECT CONVERT(varchar(10), asp_time1, 120) AS 写入日, COUNT(*) AS 行数, MIN(单据日期) AS 该批最早单据日期
FROM bd_so_order GROUP BY CONVERT(varchar(10), asp_time1, 120) ORDER BY 1;

PRINT '=== bd_pu_order 写入批次(按写入日) ===';
SELECT CONVERT(varchar(10), asp_time1, 120) AS 写入日, COUNT(*) AS 行数, MIN(单据日期) AS 该批最早单据日期
FROM bd_pu_order GROUP BY CONVERT(varchar(10), asp_time1, 120) ORDER BY 1;

PRINT '=== bl_so_order / bl_pu_order 行数 ===';
SELECT (SELECT COUNT(*) FROM bl_so_order) AS 销售订单行, (SELECT COUNT(*) FROM bl_pu_order) AS 采购订单行,
       (SELECT COUNT(DISTINCT 单据编号) FROM bl_so_order) AS 销售订单行内单号数;
