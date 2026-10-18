/* migrate-role-grant-fill-20261018.sql — 角色面板权限:补齐「已因同模块放行而可读」的面板授权行

   【用户口径 2026-10-18】角色面板权限「对照现在的模块分类以及对应面板权限」更新。
   【背景】module_group 归一后(见 migrate-role-panel-modules-20261018.sql),矩阵按 8 个一级模块分组;
      实测仍有 51 张面板**一行授权都没有**(商品/仓库/客户/供应商/部门/职员/计量单位…生产记录类),
      矩阵里全空 = 管理员只能逐个猜着勾。
   【本脚本只做"记账对齐",不扩权】读权限放行集合 = 可见 ∪ 参照目标 ∪ **同模块面板**(PanelPermissionService
      readablePanels / 报表 navGroup 同源)。因此对「该角色在本模块已有至少一张面板授权」的面板,
      它本来就已经可读;这里补 view,query 两词把这层既有关系写进 yj_role_panel,矩阵不再显示成空白。
      ⇒ 对「本模块一张都没授」的面板(如普通用户 × 数据建模:字段管理/数据字典/ERP导入日志)一律**不动**。
   【幂等】只插缺失行。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @inserted int = 0;
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.role_id, p.panel_code, 'N', N'view,query'
FROM yj_panel p
JOIN (SELECT DISTINCT role_id, module_group FROM yj_role_panel rp JOIN yj_panel x ON x.panel_code = rp.panel_code) r
  ON r.module_group = p.module_group
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel q WHERE q.role_id = r.role_id AND q.panel_code = p.panel_code);
SET @inserted = @@ROWCOUNT;

DECLARE @db sysname = DB_NAME();
RAISERROR(N'[OK] %s 补齐授权行 %d 条(仅限该角色本模块已有授权的面板,不扩权)', 10, 1, @db, @inserted);
GO

/* 自检:不允许把「本模块零授权」的面板补进来 —— 抽查 普通用户 × 数据建模 必须仍为 0 行 */
DECLARE @leak int = (SELECT COUNT(*) FROM yj_role_panel r
                      JOIN yj_panel p ON p.panel_code = r.panel_code
                     WHERE r.role_id = 2 AND p.module_group = N'数据建模');
IF @leak > 0 RAISERROR(N'[FAIL] 普通用户被补进了数据建模的 %d 张面板(应为 0)', 16, 1, @leak);
ELSE PRINT N'[OK] 数据建模仍仅管理员可配(普通用户 0 行)';
GO

SELECT CONCAT('剩余无授权面板 ', CAST(COUNT(*) AS varchar)) FROM yj_panel p
 WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel r WHERE r.panel_code = p.panel_code);
GO
