SET NOCOUNT ON;
SELECT TOP 10 单据编号, COUNT(*) AS 行数, MIN(行号) AS 最小, MAX(行号) AS 最大 FROM bl_so_order GROUP BY 单据编号 HAVING COUNT(*)>=3 ORDER BY 单据编号 DESC;
GO
SELECT 单据编号, id, 行号, 存货编码, 数量 FROM bl_so_order WHERE 单据编号 IN (N'ZXL-20261103-01', N'ZXL-20260930-04') ORDER BY 单据编号, id;
GO
SELECT SUM(CASE WHEN 行号 IS NULL THEN 1 ELSE 0 END) AS 空行号, COUNT(*) AS 总行 FROM bl_so_order;
GO
SELECT COUNT(*) AS 重复单数 FROM (SELECT 单据编号 FROM bl_so_order GROUP BY 单据编号 HAVING COUNT(*) <> COUNT(DISTINCT ISNULL(行号,-1))) t;
