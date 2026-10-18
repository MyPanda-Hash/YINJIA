SET NOCOUNT ON;
SELECT id, role_name FROM yj_role;
PRINT '--- 引用这三个角色的账号 ---';
SELECT username, is_admin, role_id FROM yj_user WHERE role_id IN (5,6,7);
PRINT '--- 引用这三个角色的其它表 ---';
SELECT COUNT(*) AS role_panel行 FROM yj_role_panel WHERE role_id IN (5,6,7);
