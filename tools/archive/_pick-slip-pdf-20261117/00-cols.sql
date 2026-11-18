SET NOCOUNT ON;
SELECT 'wo_pick_doc' AS tbl, c.name, t.name AS typ
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.wo_pick_doc') ORDER BY c.column_id;
SELECT 'wo_pick_line' AS tbl, c.name, t.name AS typ
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.wo_pick_line') ORDER BY c.column_id;
