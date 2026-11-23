SET NOCOUNT ON;
SELECT CONVERT(varchar(10),id)+N'|'+ISNULL(username,N'<null>')+N'|'+ISNULL(real_name,N'')+N'|'+ISNULL(is_admin,N'')+N'|'+ISNULL(CONVERT(varchar(10),role_id),N'') AS r FROM yj_user ORDER BY id;
GO
