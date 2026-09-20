-- migrate-rd-2026-newpanels-perm.sql — 两张新面板的角色授权行(Phase 6)
--
-- 【为什么需要】新面板只有 yj_panel/yj_field 行不足以让**非管理员**看见:
--   可见性走 yj_role_panel(role_id + panel_code + perms),由 filterMenuTree 按 visiblePanels 过滤菜单。
--   本机现有两角色:id=1 admin(管理员,恒可见)、id=2 user(普通用户)。
--
-- 【perms 取值口径(照既有面板现成写法,不自己发明)】
--   · 普通文书/记录面板(22 面):view,query,add,modify,modlog,del,export
--   · 单单据面板 RD_PROGRESS     :view,query,add,export,edit,delete,print,price,review,adjust
--   ⇒
--   · RD_PROD_DOCLIST(只读派生矩阵、单张承载单):**只给读+导出**
--       view,query,export,print —— 它没有可编辑/可归档的内容,给 modify/del 是无意义的权限位
--   · RD_SAMPLE_NO(发号台账、入归档闭环):照普通文书面板
--       view,query,add,modify,modlog,del,export
--
-- can_approve:留 'N' —— 审批权由组织架构按角色单独勾(既有行也都是 N,不替业务预设)。
--
-- 幂等:NOT EXISTS 按 role_id + panel_code 去重,可重复执行。
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
USE HSDZ_MES;

DECLARE @perms TABLE (panel_code nvarchar(40), perms nvarchar(400));
INSERT INTO @perms VALUES
  (N'RD_PROD_DOCLIST', N'view,query,export,print'),
  (N'RD_SAMPLE_NO',    N'view,query,add,modify,modlog,del,export');

-- 给每个既有角色补行(admin 也补:保持权限矩阵完整可查;admin 另有恒过逻辑,不依赖此行)
INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, p.panel_code, p.perms, 'N'
FROM yj_role r
CROSS JOIN @perms p
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel x
                  WHERE x.role_id = r.id AND x.panel_code = p.panel_code);

PRINT N'新面板授权行已补齐';
SELECT rp.role_id, r.role_name, rp.panel_code, rp.perms, rp.can_approve
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code IN (N'RD_PROD_DOCLIST', N'RD_SAMPLE_NO')
ORDER BY rp.role_id, rp.panel_code;
GO
