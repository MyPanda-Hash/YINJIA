SET NOCOUNT ON;
SELECT c.name, t.name AS 类型, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.yj_panel') ORDER BY c.column_id;
PRINT '--- yj_field ---';
SELECT c.name, t.name AS 类型, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
