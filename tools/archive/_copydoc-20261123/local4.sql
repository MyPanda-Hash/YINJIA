SET NOCOUNT ON;
SELECT TOP 10 username+N'|'+ISNULL(real_name,N'')+N'|'+ISNULL(is_admin,N'')+N'|'+CAST(role_id AS varchar(10)) AS r FROM yj_user WHERE username='admin' OR username LIKE '%admin%';
GO
SELECT TOP 20 rp.role_id+N'|'+rp.panel_code+N'|'+ISNULL(rp.perms,N'') AS r FROM yj_role_panel rp WHERE rp.panel_code IN ('RD_APPROVAL','RD_SAMPLE_EXT','RD_PROD_INFO','RD_SAMPLE_ND') ORDER BY rp.role_id;
GO
