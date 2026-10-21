SET NOCOUNT ON;
SELECT id, username, real_name FROM yj_user WHERE real_name IN (N'周荣香',N'李克强') OR username IN (N'周荣香',N'李克强');
