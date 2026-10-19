SET NOCOUNT ON;
SELECT 1 AS n, m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_stock_movement');
