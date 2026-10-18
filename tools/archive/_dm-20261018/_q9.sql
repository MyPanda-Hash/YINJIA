SET NOCOUNT ON;
SELECT COUNT(*) n, MIN(asp_time1) 最早创建, MAX(asp_time1) 最晚创建 FROM bd_purchase_in WHERE ISNULL([ERP单号],N'')<>N'';
PRINT '--- 采购入库(金蝶)单据日期分布 ---';
SELECT YEAR([单据日期]) y, MONTH([单据日期]) m, COUNT(*) n FROM bd_purchase_in WHERE ISNULL([ERP单号],N'')<>N'' GROUP BY YEAR([单据日期]), MONTH([单据日期]) ORDER BY y, m;
