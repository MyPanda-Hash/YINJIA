SET NOCOUNT ON;
SELECT rid, 物料编码, 批号, asp_cancel AS 作废 FROM dbo.outh WHERE src = 6 AND rid = 1975 ORDER BY id;
SELECT COUNT(*) AS 该单行数 FROM dbo.outh WHERE src = 6 AND 单据编号 = N'SCLL-20260902-00011';
SELECT COUNT(*) AS 成本表行, (SELECT COUNT(*) FROM dbo.v_stock_ledger) AS 台账行 FROM dbo.inv_cost_ledger;
