-- migrate-scm-qc-perms-20260924.sql — 智能供应链+品质管理 两模块角色授权补齐(2026-09-24)
-- 【为什么需要】新面板只有 yj_panel/yj_field 行不足让**非管理员**看见:可见性走 yj_role_panel,
--   本库 51 个面板中大量无授权行(实测 30+)。本支按 migrate-rd-2026-newpanels-perm 同口径补齐。
-- 【perms 分档】报表/明细/统计/目录/追溯类=只读+导出(view,query,export,print);
--   单据/档案类=普通文书全权(view,query,add,modify,modlog,del,export)。
-- can_approve='N'(审批权由组织架构按角色单独勾,不替业务预设)。幂等:NOT EXISTS 按 role_id+panel_code。
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;

DECLARE @perms TABLE (panel_code nvarchar(40), perms nvarchar(400));
INSERT INTO @perms VALUES
  (N'SO_ORDER', N'view,query,add,modify,modlog,del,export'),
  (N'SALES_ORDER_DETAIL', N'view,query,export,print'),
  (N'SALES_ORDER_STATS', N'view,query,export,print'),
  (N'PU_REQ', N'view,query,add,modify,modlog,del,export'),
  (N'PU_ORDER', N'view,query,add,modify,modlog,del,export'),
  (N'QC_RECV', N'view,query,add,modify,modlog,del,export'),
  (N'QC_RETURN', N'view,query,add,modify,modlog,del,export'),
  (N'PURCHASE_IN', N'view,query,add,modify,modlog,del,export'),
  (N'FINISH_IN', N'view,query,add,modify,modlog,del,export'),
  (N'OTHER_IN', N'view,query,add,modify,modlog,del,export'),
  (N'OUTSOURCE_IN', N'view,query,add,modify,modlog,del,export'),
  (N'SALE_OUT', N'view,query,add,modify,modlog,del,export'),
  (N'MATERIAL_OUT', N'view,query,add,modify,modlog,del,export'),
  (N'OTHER_OUT', N'view,query,add,modify,modlog,del,export'),
  (N'OUTSOURCE_ISSUE', N'view,query,add,modify,modlog,del,export'),
  (N'PURCHASE_IN_DETAIL', N'view,query,export,print'),
  (N'FINISH_IN_DETAIL', N'view,query,export,print'),
  (N'OTHER_IN_DETAIL', N'view,query,export,print'),
  (N'OUTSOURCE_IN_DETAIL', N'view,query,export,print'),
  (N'SALE_OUT_DETAIL', N'view,query,export,print'),
  (N'MATERIAL_OUT_DETAIL', N'view,query,export,print'),
  (N'OTHER_OUT_DETAIL', N'view,query,export,print'),
  (N'OUTSOURCE_ISSUE_DETAIL', N'view,query,export,print'),
  (N'PURCHASE_IN_STATS', N'view,query,export,print'),
  (N'FINISH_IN_STATS', N'view,query,export,print'),
  (N'OTHER_IN_STATS', N'view,query,export,print'),
  (N'OUTSOURCE_IN_STATS', N'view,query,export,print'),
  (N'SALE_OUT_STATS', N'view,query,export,print'),
  (N'MATERIAL_OUT_STATS', N'view,query,export,print'),
  (N'OTHER_OUT_STATS', N'view,query,export,print'),
  (N'OUTSOURCE_ISSUE_STATS', N'view,query,export,print'),
  (N'STOCK_BALANCE', N'view,query,export,print'),
  (N'STOCK_LEDGER', N'view,query,export,print'),
  (N'STOCK_SUMMARY', N'view,query,export,print'),
  (N'QC_INSP', N'view,query,add,modify,modlog,del,export'),
  (N'QC_TC_IN', N'view,query,add,modify,modlog,del,export'),
  (N'QC_CATALOG', N'view,query,export,print'),
  (N'QC_INSP_REC', N'view,query,add,modify,modlog,del,export'),
  (N'QC_INSP_REQ', N'view,query,export,print'),
  (N'QC_OP', N'view,query,add,modify,modlog,del,export'),
  (N'QC_RECORD', N'view,query,add,modify,modlog,del,export'),
  (N'QC_DISPOSAL', N'view,query,add,modify,modlog,del,export'),
  (N'ROD_RETURN', N'view,query,add,modify,modlog,del,export'),
  (N'LOT_TRACE', N'view,query,export,print'),
  (N'QC_BHG', N'view,query,add,modify,modlog,del,export'),
  (N'QC_BHC', N'view,query,add,modify,modlog,del,export'),
  (N'QC_BHZ', N'view,query,add,modify,modlog,del,export'),
  (N'QC_JJF', N'view,query,add,modify,modlog,del,export'),
  (N'QC_SCP', N'view,query,add,modify,modlog,del,export'),
  (N'QC_LYB', N'view,query,add,modify,modlog,del,export'),
  (N'QC_SCY', N'view,query,add,modify,modlog,del,export');

INSERT INTO yj_role_panel (role_id, panel_code, perms, can_approve)
SELECT r.id, p.panel_code, p.perms, 'N'
FROM yj_role r CROSS JOIN @perms p
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.role_id = r.id AND rp.panel_code = p.panel_code);

SELECT N'补齐后授权行: ' + CAST(COUNT(*) AS varchar(10)) FROM yj_role_panel;
SELECT N'仍无授权面板: ' + CAST(COUNT(*) AS varchar(10)) FROM @perms p
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.panel_code = p.panel_code);
PRINT N'migrate-scm-qc-perms-20260924 完成';
GO
