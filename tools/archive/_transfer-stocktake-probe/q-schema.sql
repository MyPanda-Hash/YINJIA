SET NOCOUNT ON;
PRINT '=== kucun 列 ===';
SELECT c.name, t.name AS typ, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
PRINT '=== bd_other_out 列(头) ===';
SELECT c.name, t.name AS typ, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bd_other_out') ORDER BY c.column_id;
PRINT '=== bl_other_out 列(行) ===';
SELECT c.name, t.name AS typ, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bl_other_out') ORDER BY c.column_id;
