SET NOCOUNT ON;
SELECT username+N'|'+ISNULL(real_name,N'')+N'|'+ISNULL(is_admin,N'')+N'|'+CONVERT(varchar(10),role_id) AS r FROM yj_user ORDER BY id;
GO
SELECT CONVERT(varchar(10),role_id)+N'|'+role_name AS r FROM yj_role ORDER BY role_id;
GO
