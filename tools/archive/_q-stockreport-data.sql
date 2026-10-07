SET NOCOUNT ON;
SET STATISTICS TIME OFF;
SELECT 'inv_cost_ledger 行数' AS k, COUNT(*) AS n FROM inv_cost_ledger
UNION ALL SELECT 'inv_cost_ledger 重算时间种类', COUNT(DISTINCT 重算时间) FROM inv_cost_ledger
UNION ALL SELECT 'v_stock_movement 行数', COUNT(*) FROM v_stock_movement
UNION ALL SELECT 'v_stock_ledger 行数', COUNT(*) FROM v_stock_ledger
UNION ALL SELECT 'v_stock_summary 行数', COUNT(*) FROM v_stock_summary
UNION ALL SELECT 'v_stock_balance 行数', COUNT(*) FROM v_stock_balance
UNION ALL SELECT 'kucun 行数', COUNT(*) FROM kucun;
GO
SELECT TOP 3 * FROM inv_cost_ledger ORDER BY src, rid;
GO
SELECT MAX(重算时间) AS 最近重算, MIN(重算时间) AS 最早重算 FROM inv_cost_ledger;
GO
SELECT SUM(结存金额) AS 结存金额合计, SUM(结存数量) AS 结存数量合计 FROM v_stock_balance;
GO
