SET NOCOUNT ON;
SELECT TOP 10 仓库, 存货, 批号, 数量 FROM kucun WHERE ISNULL(数量,0) > 0 ORDER BY 数量 DESC;
GO
SELECT TOP 5 * FROM inv_cost_ledger ORDER BY id DESC;
GO
SELECT COUNT(*) AS kucun_rows FROM kucun;
GO
