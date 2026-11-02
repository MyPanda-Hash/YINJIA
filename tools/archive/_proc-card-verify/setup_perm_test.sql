/* 权限验证造数:临时角色 PFC_VERIFY(先只给 PROC_FLOW_CARD=view)+ 临时账号 pfc_verify
   口令哈希复制自 admin(同一口令 123456);验证完由 teardown_perm_test.sql 全部删除。
   ⚠ 只动自己新建的行;不碰既有角色/账号。 */
SET NOCOUNT ON;
PRINT N'==== setup @' + DB_NAME() + N' ====';

/* 幂等:先清掉可能残留的同名造数 */
DELETE FROM dbo.yj_role_panel WHERE role_id IN (SELECT id FROM dbo.yj_role WHERE role_code = N'PFC_VERIFY');
DELETE FROM dbo.yj_role WHERE role_code = N'PFC_VERIFY';
DELETE FROM dbo.yj_user WHERE username = N'pfc_verify';
GO

INSERT INTO dbo.yj_role (role_code, role_name, remark) VALUES (N'PFC_VERIFY', N'流程卡验证临时角色', N'独立验证造数,验证后立即删除');
GO

DECLARE @roleId int = (SELECT id FROM dbo.yj_role WHERE role_code = N'PFC_VERIFY');
/* 场景 1:只有 view 词(有查看权、无录入/确认权) */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
VALUES (@roleId, N'PROC_FLOW_CARD', N'N', N'view');
INSERT INTO dbo.yj_user (username, password_hash, real_name, is_admin, dept_id, role_id, enabled)
SELECT N'pfc_verify', password_hash, N'流程卡验证账号', N'N', NULL, @roleId, N'1'
  FROM dbo.yj_user WHERE username = N'admin';
GO

SELECT N'临时角色' AS 项, r.id AS 值, r.role_code AS 说明 FROM dbo.yj_role r WHERE r.role_code = N'PFC_VERIFY';
GO
SELECT p.panel_code, p.perms FROM dbo.yj_role_panel p JOIN dbo.yj_role r ON r.id = p.role_id WHERE r.role_code = N'PFC_VERIFY';
GO
SELECT u.id, u.username, u.is_admin, u.role_id, u.enabled FROM dbo.yj_user u WHERE u.username = N'pfc_verify';
GO
