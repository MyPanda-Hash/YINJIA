SET NOCOUNT ON;
PRINT '=== category x module_group ===';
SELECT category, module_group, COUNT(*) n FROM yj_panel GROUP BY category, module_group ORDER BY category, module_group;
PRINT '=== yj_role_panel 列 ===';
SELECT c.name, t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.yj_role_panel') ORDER BY c.column_id;
PRINT '=== 角色 ===';
SELECT id, role_name, is_admin FROM yj_role ORDER BY id;
PRINT '=== 有 OTHER_OUT/OTHER_IN 权限的角色 ===';
SELECT r.role_name, p.panel_code, p.perms FROM yj_role r JOIN yj_role_panel p ON p.role_id=r.id WHERE p.panel_code IN ('OTHER_OUT','OTHER_IN') ORDER BY r.id;
