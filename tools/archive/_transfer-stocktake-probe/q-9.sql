SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.v_stock_kucun') ORDER BY c.column_id;
