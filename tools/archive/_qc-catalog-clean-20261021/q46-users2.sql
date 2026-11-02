SET NOCOUNT ON;
SELECT id, username, real_name, is_admin, role_id, enabled, islogin, usertype FROM yj_user WHERE real_name LIKE N'%冯敏%' OR username LIKE N'%feng%' OR is_admin='Y' ORDER BY id;
