SET NOCOUNT ON;
SELECT 'V|' + REPLACE(REPLACE(m.definition, CHAR(13), ' '), CHAR(10), ' ')
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.name IN ('v_stock_pick');
SELECT 'TBL|' + TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME IN ('ck','kucun','mate') ORDER BY TABLE_NAME;
