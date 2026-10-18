SET NOCOUNT ON;
PRINT '=== bl_transfer 列 ===';
SELECT c.name, t.name typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bl_transfer') ORDER BY c.column_id;
