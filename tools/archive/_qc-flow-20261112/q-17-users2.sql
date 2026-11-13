SET NOCOUNT ON;
SELECT id, username, real_name, role_id, is_admin, enabled FROM dbo.yj_user ORDER BY id;
SELECT id, role_code, role_name, is_admin FROM dbo.yj_role ORDER BY id;
SELECT r.role_code, COUNT(*) AS 面板数 FROM dbo.yj_role_panel p JOIN dbo.yj_role r ON r.id = p.role_id GROUP BY r.role_code;
