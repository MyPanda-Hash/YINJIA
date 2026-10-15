/* q-23-test-cost.sql — 测试账套的成本表状态(只读) */
SET NOCOUNT ON;
GO
SELECT N'HSDZ_MES_TEST' AS db, COUNT(*) AS 成本表行数,
       CAST(SUM(发出成本金额) AS decimal(18,2)) AS 发出成本合计,
       CONVERT(nvarchar(23), MAX(重算时间), 121) AS 最近重算
FROM dbo.inv_cost_ledger;
GO
SELECT N'测试账套流水' AS k, (SELECT COUNT(*) FROM dbo.v_stock_movement) AS 流水行数,
       (SELECT COUNT(*) FROM dbo.inh WHERE src = 0) AS 期初行数;
GO
