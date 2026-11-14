SET NOCOUNT ON;
SELECT id, user_name, real_name, role_code, ISNULL(enabled,'') AS enabled, LEFT(ISNULL(password,''),12) AS pwd_head FROM dbo.yj_user;
SELECT id, role_code, role_name, is_admin FROM dbo.yj_role;
SELECT r.role_code, COUNT(*) AS 面板数 FROM dbo.yj_role_panel p JOIN dbo.yj_role r ON r.id = p.role_id GROUP BY r.role_code;
