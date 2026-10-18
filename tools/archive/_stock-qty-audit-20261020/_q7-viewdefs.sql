SET NOCOUNT ON;
SELECT OBJECT_NAME(m.object_id) AS obj, m.definition
FROM sys.sql_modules m
WHERE m.object_id IN (OBJECT_ID('dbo.v_stock_balance'), OBJECT_ID('dbo.v_stock_kucun'), OBJECT_ID('dbo.v_stock_pick'))
ORDER BY obj;
