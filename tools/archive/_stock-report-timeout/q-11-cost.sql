/* q-11-cost.sql — 成本物化表现状(只读) */
SET NOCOUNT ON;
GO
SELECT N'inv_cost_ledger 行数' AS k, COUNT(*) AS n FROM inv_cost_ledger;
GO
SELECT name, (SELECT SUM(p.rows) FROM sys.partitions p WHERE p.object_id = t.object_id AND p.index_id IN (0,1)) AS 行数
FROM sys.tables t WHERE t.name LIKE '%cost%' OR t.name LIKE '%inv_cost%' ORDER BY name;
GO
SELECT N'报表口径对比' AS k,
       (SELECT COUNT(*) FROM v_stock_balance) AS 状况行,
       (SELECT SUM(结存金额) FROM v_stock_balance) AS 结存金额合计,
       (SELECT SUM(收入金额) FROM v_stock_movement) AS 流水收入金额合计,
       (SELECT COUNT(*) FROM v_stock_movement) AS 流水行数;
GO
SELECT TOP 5 src, rid, 结存数量, 移动加权单价, 结存金额 FROM inv_cost_ledger ORDER BY src, rid;
GO
