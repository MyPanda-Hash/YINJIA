SET NOCOUNT ON;
SELECT p.name AS 过程名, USER_NAME(p.principal_id) AS 所有者, s.name AS 架构
FROM sys.procedures p JOIN sys.schemas s ON s.schema_id=p.schema_id ORDER BY p.name;
SELECT pr.name AS 主体, p.permission_name, p.state_desc
FROM sys.database_permissions p JOIN sys.database_principals pr ON pr.principal_id=p.grantee_principal_id
WHERE p.class_desc='OBJECT_OR_COLUMN' AND p.permission_name='EXECUTE' ORDER BY pr.name;
SELECT u.name AS 用户, r.name AS 角色 FROM sys.database_role_members m
JOIN sys.database_principals u ON u.principal_id=m.member_principal_id
JOIN sys.database_principals r ON r.principal_id=m.role_principal_id ORDER BY u.name;
