SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM dbo.v_stock_movement) AS 流水行,
       (SELECT COUNT(*) FROM dbo.v_stock_ledger) AS 台账行,
       (SELECT COUNT(*) FROM dbo.inv_cost_ledger) AS 成本行,
       (SELECT COUNT(*) FROM dbo.v_stock_balance) AS 现存量行;
SELECT TOP 3 name, type_desc FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.inv_cost_ledger');
