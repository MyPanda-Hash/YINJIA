SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.yj_panel') ORDER BY c.column_id;
