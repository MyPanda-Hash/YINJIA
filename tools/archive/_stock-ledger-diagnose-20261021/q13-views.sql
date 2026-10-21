SET NOCOUNT ON;
SELECT name, LEFT(definition, 3000) AS 定义 FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE o.name IN ('v_stock_kucun','v_stock_balance') ORDER BY o.name;
