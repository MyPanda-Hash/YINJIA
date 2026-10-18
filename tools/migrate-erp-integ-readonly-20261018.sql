-- =====================================================================================
-- migrate-erp-integ-readonly-20261018.sql — ERP集成配置清单:非管理员「只可看不可编辑」
--
-- 用户口径(2026-10-18):「保证这个面板除管理员只可看不可编辑」。
--
-- 口径拆成两半(代码侧已实现,本脚本只补**授权数据**):
--   ① 读:非管理员可看 —— 与同栏目 ERPLG / FIELDMGR / ZDGL 一样,给所有**非管理员角色**
--      补一行 yj_role_panel(panel_code='ERP_INTEG', perms='view', can_approve='N');
--      (该页面在 PagePanelRegistry 里只登记了 view 一个动作,矩阵里也只有「可见」一个格子)
--   ② 写:仅管理员 —— 不挂权限词,服务端 ErpIntegController 的写接口直接 requireAdmin(),
--      非管理员一律 403(返回体 code=403);故**本脚本不授任何写词**,矩阵里也授不出去。
--
-- 幂等:NOT EXISTS 判重,重复执行 0 行;两账套(HSDZ_MES → HSDZ_MES_TEST)各跑一次。
-- 回退:DELETE FROM yj_role_panel WHERE panel_code='ERP_INTEG' AND can_approve='N'
--        AND role_id IN (SELECT id FROM yj_role WHERE is_admin='N');
-- =====================================================================================
SET NOCOUNT ON;
PRINT N'== migrate-erp-integ-readonly-20261018 ==';

INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, 'ERP_INTEG', 'N', 'view'
  FROM yj_role r
 WHERE ISNULL(r.is_admin, 'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM yj_role_panel p
                    WHERE p.role_id = r.id AND p.panel_code = 'ERP_INTEG');
PRINT N'  非管理员角色补 ERP_INTEG 可见(perms=view)';

-- 自检:非管理员角色必须**全部**有可见、且**一行都不含写词**
DECLARE @roles int, @visible int, @writeWords int;
SELECT @roles = COUNT(*) FROM yj_role WHERE ISNULL(is_admin, 'N') <> 'Y';
SELECT @visible = COUNT(*) FROM yj_role_panel p JOIN yj_role r ON r.id = p.role_id
 WHERE ISNULL(r.is_admin, 'N') <> 'Y' AND p.panel_code = 'ERP_INTEG' AND p.perms LIKE '%view%';
SELECT @writeWords = COUNT(*) FROM yj_role_panel p JOIN yj_role r ON r.id = p.role_id
 WHERE ISNULL(r.is_admin, 'N') <> 'Y' AND p.panel_code = 'ERP_INTEG'
   AND (p.perms LIKE '%add%' OR p.perms LIKE '%modify%' OR p.perms LIKE '%del%' OR p.perms LIKE '%save%');
SELECT @roles AS 非管理员角色数, @visible AS 已授可见数, @writeWords AS 含写词行数;
IF @visible < @roles OR @writeWords <> 0
    RAISERROR(N'ERP_INTEG 授权自检失败(可见数应=角色数,写词必须为 0)', 16, 1);

PRINT N'== migrate-erp-integ-readonly-20261018 完成 ==';
