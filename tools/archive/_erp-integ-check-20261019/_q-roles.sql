SET NOCOUNT ON;
PRINT N'-- roles';
SELECT id, role_code, role_name, is_admin FROM yj_role ORDER BY id;
PRINT N'-- users';
SELECT u.id, u.username, u.real_name, r.role_name, r.is_admin
  FROM yj_user u LEFT JOIN yj_role r ON r.id = u.role_id ORDER BY u.id;
