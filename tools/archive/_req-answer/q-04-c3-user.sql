SET NOCOUNT ON;
PRINT N'=== C3:用户表结构与行数 ===';
SELECT c.column_id, c.name AS 列名, t.name AS 类型
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('yj_user') ORDER BY c.column_id;
GO
SELECT id, username, real_name, is_admin, dept_id, role_id, enabled FROM yj_user ORDER BY id;
GO
PRINT N'=== C3:角色与角色授权 ===';
SELECT * FROM yj_role ORDER BY id;
GO
IF OBJECT_ID('yj_role_panel') IS NOT NULL
  SELECT COUNT(*) AS 角色面板授权行数 FROM yj_role_panel;
GO
PRINT N'=== C3:供应商相关字段是否存在于用户表(全库扫) ===';
SELECT t.name AS 表名, c.name AS 列名
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name LIKE N'%supplier%' OR c.name LIKE N'%供应商%'
ORDER BY t.name;
GO
