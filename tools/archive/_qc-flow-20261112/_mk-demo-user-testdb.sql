SET NOCOUNT ON;
/* 演示账号(仅测试账套):角色=sc(有 QC_FLOW + QC_INSP,**没有** QC_RECV / PURCHASE_IN),
   用于验证「看板上没有该面板权限的节点点了不跳」。密码哈希沿用 admin(即 123456)。测完删除。 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_user WHERE username = 'qcflowdemo')
INSERT INTO dbo.yj_user (username, password_hash, real_name, is_admin, role_id, enabled)
SELECT 'qcflowdemo', u.password_hash, N'流程监控演示', 'N',
       (SELECT id FROM dbo.yj_role WHERE role_code = 'sc'), 1
  FROM dbo.yj_user u WHERE u.username = 'admin';
SELECT id, username, real_name, role_id, is_admin, enabled FROM dbo.yj_user WHERE username = 'qcflowdemo';
