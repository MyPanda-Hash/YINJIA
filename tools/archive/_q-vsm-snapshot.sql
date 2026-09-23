SET NOCOUNT ON;
SELECT 'mv_rows' AS k, COUNT(*) AS v FROM v_stock_movement
UNION ALL SELECT 'mv_sum_in', CAST(SUM(收入数量) AS bigint) FROM v_stock_movement
UNION ALL SELECT 'mv_sum_amt', CAST(CAST(SUM(收入金额) AS decimal(18,2)) AS bigint) * 100 FROM v_stock_movement
UNION ALL SELECT 'cost_rows', COUNT(*) FROM inv_cost_ledger;
GO
PRINT '== 仓库键分布(分区数/前5) ==';
SELECT COUNT(*) AS wh_keys FROM (SELECT DISTINCT 仓库键, 存货编码 FROM v_stock_movement) t;
SELECT TOP 5 仓库键, COUNT(*) AS n FROM v_stock_movement GROUP BY 仓库键 ORDER BY n DESC;
GO
