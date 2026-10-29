/* 权限验证前置取证:账号/角色现状(只读)。用于临时改授权前后对比,改完必须恢复。 */
SET NOCOUNT ON;
PRINT N'==== @DB = ' + DB_NAME() + N' ====';
SELECT u.id, u.username, ISNULL(u.real_name,N'') AS real_name, u.is_admin, ISNULL(u.role_id,-1) AS role_id, u.enabled
  FROM dbo.yj_user u
 WHERE u.username IN (N'admin', N'tester01') OR u.is_admin = N'N'
 ORDER BY u.id;
GO
SELECT r.id, ISNULL(r.role_name,N'') AS role_name, ISNULL(r.role_code,N'') AS role_code
  FROM dbo.yj_role r ORDER BY r.id;
GO
SELECT role_id, panel_code, perms FROM dbo.yj_role_panel
 WHERE panel_code = N'PROC_FLOW_CARD' ORDER BY role_id;
GO
