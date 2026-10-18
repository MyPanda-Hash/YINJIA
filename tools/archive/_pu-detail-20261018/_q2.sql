SET NOCOUNT ON;
PRINT '=== bd_pu_order 列 ===';
SELECT c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bd_pu_order') ORDER BY c.column_id;
PRINT '=== bl_pu_order 列 ===';
SELECT c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bl_pu_order') ORDER BY c.column_id;
PRINT '=== 行数 ===';
SELECT (SELECT COUNT(*) FROM bd_pu_order) AS 头, (SELECT COUNT(*) FROM bl_pu_order) AS 行;
