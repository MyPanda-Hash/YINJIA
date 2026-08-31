/* 角色面板操作权限扩展:从 可见+审批 两个维度 扩展为 11 项操作权限
   perms 列存储逗号分隔的操作码 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('yj_role_panel') AND name = 'perms') RETURN;
GO
ALTER TABLE yj_role_panel ADD perms nvarchar(500) NULL;
GO
-- 迁移旧数据: can_approve='Y' -> audit; panel 存在即有 view
UPDATE yj_role_panel SET perms = 'view' + CASE WHEN can_approve = 'Y' THEN ',audit' ELSE '' END WHERE perms IS NULL;
GO
GRANT SELECT, INSERT, UPDATE, DELETE ON yj_role_panel TO yinjia;
GO
PRINT N'角色面板权限扩展完成(11 项操作权限)';
GO
