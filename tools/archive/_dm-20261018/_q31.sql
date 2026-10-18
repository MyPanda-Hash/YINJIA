SET NOCOUNT ON;
SELECT TOP 15 u.username, u.is_admin, r.role_name, COUNT(rp.panel_code) AS 面板数 FROM yj_user u LEFT JOIN yj_role r ON r.id=u.role_id LEFT JOIN yj_role_panel rp ON rp.role_id=u.role_id AND rp.perms LIKE '%view%' WHERE ISNULL(u.is_admin,'N')<>'Y' GROUP BY u.username, u.is_admin, r.role_name ORDER BY 面板数 DESC;
