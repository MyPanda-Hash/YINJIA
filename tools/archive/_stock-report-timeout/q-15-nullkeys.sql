/* q-15-nullkeys.sql — 为什么重算 INSERT 会撞 NOT NULL:流水里的键列空值分布(只读) */
SET NOCOUNT ON;
GO
SELECT N'流水键列空值' AS k,
       SUM(CASE WHEN 仓库键 IS NULL THEN 1 ELSE 0 END) AS 仓库键NULL,
       SUM(CASE WHEN 存货编码 IS NULL THEN 1 ELSE 0 END) AS 存货编码NULL,
       SUM(CASE WHEN 批号 IS NULL THEN 1 ELSE 0 END) AS 批号NULL,
       COUNT(*) AS 合计
FROM dbo.v_stock_movement;
GO
SELECT TOP 20 src, rid, 单据类型, 单据编号, 仓库编码, 仓库, 仓库键, 存货编码, 批号, 数量, 单据日期
FROM dbo.v_stock_movement
WHERE 仓库键 IS NULL OR 存货编码 IS NULL OR 批号 IS NULL
ORDER BY src, rid;
GO
SELECT N'按来源分布' AS k, src, COUNT(*) AS 行数,
       SUM(CASE WHEN 仓库键 IS NULL THEN 1 ELSE 0 END) AS 仓库键NULL,
       SUM(CASE WHEN 存货编码 IS NULL THEN 1 ELSE 0 END) AS 存货编码NULL,
       SUM(CASE WHEN 批号 IS NULL THEN 1 ELSE 0 END) AS 批号NULL
FROM dbo.v_stock_movement GROUP BY src ORDER BY src;
GO
SELECT c.name, c.is_nullable FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.inv_cost_ledger') AND c.is_nullable = 0 ORDER BY c.column_id;
GO
