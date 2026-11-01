/* 场景切换:把临时角色 PROC_FLOW_CARD 的 perms 清空(= 无任何权限)→ 验证各接口全拒。
   注意:脚本头注释里不要出现斜杠星号组合(会被当成注释结束)。 */
SET NOCOUNT ON;
UPDATE p SET p.perms = N''
  FROM dbo.yj_role_panel p JOIN dbo.yj_role r ON r.id = p.role_id
 WHERE r.role_code = N'PFC_VERIFY' AND p.panel_code = N'PROC_FLOW_CARD';
GO
SELECT r.role_code, p.panel_code, p.perms FROM dbo.yj_role_panel p JOIN dbo.yj_role r ON r.id = p.role_id
 WHERE r.role_code = N'PFC_VERIFY';
GO
