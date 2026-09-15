-- migrate-qc-return-module.sql — 暂收退料单 QC_RETURN 归入「库存核算」(2026-09-15)
-- 用户口径:暂收退料单从「品质管理·来料品质」移到「库存核算·单据」(与送料暂收单相邻)。
-- 菜单侧已改 frontend/src/business/menus.js;本脚本同步 yj_panel.module_group,
-- 使权限管理界面的面板分组、以及"同模块面板读放行"(PanelPermissionService)与菜单口径一致。
-- 幂等: 可重复执行。
SET NOCOUNT ON;
UPDATE yj_panel SET module_group = N'库存核算' WHERE panel_code = 'QC_RETURN';
GO
-- 自检: QC_RETURN 应与 SL_RECV/PURCHASE_IN 同组
SELECT panel_code, panel_name, module_group FROM yj_panel
WHERE panel_code IN ('QC_RETURN', 'SL_RECV', 'PURCHASE_IN', 'QC_INSP', 'QC_RECV')
ORDER BY module_group, panel_code;
PRINT N'migrate-qc-return-module 完成:暂收退料单归入库存核算(module_group)';
GO
