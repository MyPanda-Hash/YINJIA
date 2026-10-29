-- migrate-prod-pick-panel-20261020.sql
-- 生产领料 页面级虚拟面板(PROD_PICK):角色授权 + 面板名译名
-- 幂等;两账套都要执行(先 HSDZ_MES,后 HSDZ_MES_TEST)。
--
-- 背景(用户 2026-10-20 原话):
--   「把他写成面版,这样我也可以选择在电脑端操作,名字叫生产领料在生产计划里面」
--   页面本身不是 yj_panel 单据面板(数据来自 plang / v_stock_pick / MATERIAL_OUT),
--   故按既有先例登记为**页面级虚拟面板**(定义见 PagePanelRegistry.PROD_PICK),
--   不往 yj_panel 插行 —— 空面板会污染报表/选单/字段配置等 registry.all() 的下游。
--
-- 本脚本做两件事:
--   ① 给所有角色补一条 yj_role_panel(PROD_PICK, perms=view,query,pick);
--      「真正落库」仍受 MATERIAL_OUT 面板权限约束(生成的是它的草稿),这里只是页面可见/查询权。
--   ② 面板名「生产领料」的 en 译名(AGENTS 多语言红线:新增面板必须同时给译名)。
SET NOCOUNT ON;
GO

/* ① 角色授权(与 2026-10-20 菜单改版里 BARCODE_SCAN_PICK 同口径) */
INSERT INTO dbo.yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, N'PROD_PICK', 'N', N'view,query,pick'
  FROM dbo.yj_role r
 WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x WHERE x.role_id = r.id AND x.panel_code = N'PROD_PICK');
GO

/* ② 面板译名 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'生产领料' AND locale = 'en')
  INSERT INTO dbo.yj_translation (scope, ref_key, locale, text, source)
  VALUES ('panel', N'生产领料', 'en', N'Production Picking', 'manual');
GO

/* ③ 自检:每个角色都有授权 + 译名在 */
DECLARE @miss int = (SELECT COUNT(*) FROM dbo.yj_role r
                      WHERE NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel x
                                         WHERE x.role_id = r.id AND x.panel_code = N'PROD_PICK'));
DECLARE @tr int = (SELECT COUNT(*) FROM dbo.yj_translation
                    WHERE scope = 'panel' AND ref_key = N'生产领料' AND locale = 'en');
SELECT CASE WHEN @miss = 0 AND @tr = 1 THEN N'[PASS] 生产领料面板授权与译名齐备'
            ELSE N'[FAIL] 缺授权角色 ' + CAST(@miss AS nvarchar(10)) + N' 个 / 译名 ' + CAST(@tr AS nvarchar(10)) + N' 条' END AS 结论,
       @miss AS 缺授权角色数, @tr AS 译名条数;
