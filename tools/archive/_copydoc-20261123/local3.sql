SET NOCOUNT ON;
SELECT TOP 10 username+N'|'+ISNULL(real_name,N'')+N'|'+ISNULL(is_admin,N'')+N'|'+CAST(role_id AS varchar(10)) FROM yj_user ORDER BY id;
GO
SELECT COUNT(*) AS panels FROM yj_panel WHERE panel_code IN ('RD_APPROVAL','RD_PROD_INFO','RD_SAMPLE_EXT','RD_SAMPLE_ND') AND mode='doc';
GO
