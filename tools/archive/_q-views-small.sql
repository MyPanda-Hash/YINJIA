SET NOCOUNT ON;
SELECT m.definition FROM sys.sql_modules m WHERE m.object_id=OBJECT_ID('dbo.v_stock_ledger');
GO
SELECT m.definition FROM sys.sql_modules m WHERE m.object_id=OBJECT_ID('dbo.v_stock_balance');
GO
SELECT m.definition FROM sys.sql_modules m WHERE m.object_id=OBJECT_ID('dbo.v_stock_summary');
GO
