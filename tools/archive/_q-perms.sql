SET NOCOUNT ON;
SELECT TOP 3 role_id, panel_code, CAST(perms AS nvarchar(400)) AS perms FROM yj_role_panel WHERE panel_code IN ('MANU_ORDER','SO_ORDER') ORDER BY panel_code;
SELECT COUNT(*) AS perms含按钮名 FROM yj_role_panel WHERE CAST(perms AS nvarchar(max)) LIKE N'%生成生产加工单%';
