SET NOCOUNT ON;
PRINT '--- yj_panel columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_panel') ORDER BY c.column_id;
PRINT '--- yj_field columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
PRINT '--- yj_attachment columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_attachment') ORDER BY c.column_id;
PRINT '--- yj_menu_node columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_menu_node') ORDER BY c.column_id;
