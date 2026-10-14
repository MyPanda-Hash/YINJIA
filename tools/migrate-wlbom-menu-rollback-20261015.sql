/* migrate-wlbom-menu-rollback-20261015.sql —— 回滚同批次对 WLBOM 菜单归属的误改
 *
 * 背景:migrate-wlbom-menu-to-basedata-20261015.sql 曾把 WLBOM 的
 *   category(单据→基础档案)与 module_group(生产管理→基础资料)改掉,意图是"把入口挪到基础档案"。
 *
 * **该做法无效**:左侧导航不是由 yj_panel 的 category/module_group 生成的,而是**前端硬编码**在
 *   frontend/src/business/menus.js(见该文件 code='bmat' 的「物料及价格」栏)。真正的入口缺失原因也已查明:
 *   2026-10-14 有人把「物料清单(BOM)」菜单整体下线(注释在 menus.js),但那次下架的是另一套自建 BOM
 *   (表 bs_bom / 面板 BOM 与 BOM_FWD/BOM_REV),**WLBOM(表 mate)面板与数据一直都在**。
 *   因此正确修法 = 在 menus.js 的「物料及价格」栏补回指向 **WLBOM** 的入口(本次一并完成)。
 *
 * 既已无用,就**恢复原值**以免留下无谓差异(该两列另有他用,例如 ReportService 的报表分类映射)。
 * 幂等:重复执行 = 0 行。两账套都跑(先 HSDZ_MES,后 HSDZ_MES_TEST)。
 */
SET NOCOUNT ON;

SELECT N'[回滚前] WLBOM' AS 项, ISNULL(category,N'(空)') + N' / ' + ISNULL(module_group,N'(空)') AS 值
  FROM yj_panel WHERE panel_code = N'WLBOM';

UPDATE yj_panel
   SET category = N'单据',
       module_group = N'生产管理'
 WHERE panel_code = N'WLBOM'
   AND category = N'基础档案'
   AND ISNULL(module_group, N'') = N'基础资料';
PRINT N'[回滚] 行数: ' + CAST(@@ROWCOUNT AS nvarchar(10));

SELECT panel_code, panel_name, ISNULL(category,N'') AS 分类, ISNULL(module_group,N'') AS 模块组, mode,
       ISNULL(line_table,N'') AS line_table
  FROM yj_panel WHERE panel_code = N'WLBOM';

SELECT N'[自证] WLBOM 已恢复原值(应=1)"单据/生产管理"' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值
  FROM yj_panel WHERE panel_code = N'WLBOM' AND category = N'单据' AND module_group = N'生产管理'
UNION ALL
SELECT N'[自证] 面板本体仍完好(应=1: mode=doc + line_table=mate)',
       CAST(COUNT(*) AS nvarchar(6))
  FROM yj_panel WHERE panel_code = N'WLBOM' AND mode = N'doc' AND line_table = N'mate';
