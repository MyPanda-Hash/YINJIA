SET NOCOUNT ON;
PRINT '=== yj_panel 列 ===';
SELECT c.name, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.yj_panel') ORDER BY c.column_id;
PRINT '=== 面板权限相关表 ===';
SELECT name FROM sys.tables WHERE name LIKE '%perm%' OR name LIKE 'yj_page%' ORDER BY name;
