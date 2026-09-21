-- _q-change5.sql —— 角色与账号权限(探针建号用)
SET NOCOUNT ON;
SELECT r.id, r.role_code, r.role_name, r.is_admin FROM yj_role r ORDER BY r.id;
GO
SELECT u.username, u.real_name, u.role_id, r.role_code, u.dept_id, d.dept_name
  FROM yj_user u LEFT JOIN yj_role r ON r.id = u.role_id LEFT JOIN yj_dept d ON d.id = u.dept_id
 WHERE u.username IN ('admin','cp','glm53');
GO
SELECT rp.role_id, r.role_code, rp.perms, rp.can_approve FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id WHERE rp.panel_code = 'RD_CHANGE';
GO
