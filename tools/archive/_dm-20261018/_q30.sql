SET NOCOUNT ON;
SELECT p.panel_code, p.panel_name, rp.role_id, r.role_name, rp.perms FROM yj_panel p LEFT JOIN yj_role_panel rp ON rp.panel_code = p.panel_code LEFT JOIN yj_role r ON r.id = rp.role_id WHERE p.panel_code IN ('ERPLG','ERPLG_ROW','FIELDMGR','ZDGL') ORDER BY p.panel_code, rp.role_id;
PRINT '--- 角色 ---';
SELECT id, role_name, is_admin FROM yj_role;
PRINT '--- 管理员账号 ---';
SELECT username, is_admin, role_id FROM yj_user WHERE is_admin='Y';
