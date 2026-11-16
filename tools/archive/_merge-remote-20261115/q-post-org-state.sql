SELECT N'roles' AS k, COUNT(*) AS n FROM yj_role
UNION ALL SELECT N'users', COUNT(*) FROM yj_user
UNION ALL SELECT N'role_panel_rows', COUNT(*) FROM yj_role_panel
UNION ALL SELECT N'panels', COUNT(*) FROM yj_panel
UNION ALL SELECT N'panels_without_grants', COUNT(*) FROM yj_panel p WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.panel_code = p.panel_code);
SELECT '--- 无授权的面板 ---' AS x;
SELECT p.panel_code, p.panel_name FROM yj_panel p
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.panel_code = p.panel_code)
ORDER BY p.panel_code;
SELECT '--- 管理员账号 ---' AS x;
SELECT id, username, real_name, is_admin, enabled, role_id FROM yj_user WHERE is_admin='Y' OR username='admin';
