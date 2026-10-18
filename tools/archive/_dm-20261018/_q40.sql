SET NOCOUNT ON;
SELECT rp.role_id, r.role_name, rp.panel_code, rp.perms FROM yj_role_panel rp JOIN yj_role r ON r.id=rp.role_id WHERE rp.perms LIKE '%edit%';
