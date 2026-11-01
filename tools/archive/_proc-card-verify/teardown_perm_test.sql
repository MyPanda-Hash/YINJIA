/* 权限验证收尾:删除临时账号/角色/授权行,并核对已无残留(生产库零造数) */
SET NOCOUNT ON;
PRINT N'==== teardown @' + DB_NAME() + N' ====';
DELETE FROM dbo.yj_role_panel WHERE role_id IN (SELECT id FROM dbo.yj_role WHERE role_code = N'PFC_VERIFY');
GO
DELETE FROM dbo.yj_role WHERE role_code = N'PFC_VERIFY';
GO
DELETE FROM dbo.yj_user WHERE username = N'pfc_verify';
GO
SELECT N'残留:临时角色' AS 项, COUNT(*) AS 值 FROM dbo.yj_role WHERE role_code = N'PFC_VERIFY'
UNION ALL SELECT N'残留:临时账号', COUNT(*) FROM dbo.yj_user WHERE username = N'pfc_verify'
UNION ALL SELECT N'残留:临时授权行', COUNT(*) FROM dbo.yj_role_panel x
          WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role r WHERE r.id = x.role_id)
UNION ALL SELECT N'PROC_FLOW_CARD 授权行(应恢复为 13 角色)', COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = N'PROC_FLOW_CARD';
GO
