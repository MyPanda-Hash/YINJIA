SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM dbo.v_stock_movement) AS 流水行,
       (SELECT COUNT(*) FROM dbo.v_stock_ledger) AS 台账行,
       (SELECT COUNT(*) FROM dbo.inv_cost_ledger) AS 成本行,
       (SELECT COUNT(*) FROM dbo.inv_cost_ledger WHERE src = 6 AND rid = 9) AS rid9成本行;
SELECT src, rid, 存货编码, 批号, 发出数量, 结存数量, 发出成本金额 FROM dbo.inv_cost_ledger WHERE src = 6 AND rid = 9;
