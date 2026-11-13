/* ⚠ 一次性清理脚本(2026-11-13),仅供重跑 migrate-return-docs-20261113.sql 前清掉"灌错面板"的元数据:
   把 SALE_IN/MATERIAL_RET 及其明细/统计 6 个面板的 yj_field / yj_role_panel / yj_panel 行删掉,
   **不动**表(bd_sale_in/bl_sale_in/bd_material_ret/bl_material_ret)与视图。
   删完必须立刻重跑 tools/migrate-return-docs-20261113.sql,否则这 6 个面板在界面上是空的。
   平时不需要执行。 */
SET NOCOUNT ON;
DELETE FROM yj_field WHERE panel_code IN ('SALE_IN','SALE_IN_DETAIL','SALE_IN_STATS','MATERIAL_RET','MATERIAL_RET_DETAIL','MATERIAL_RET_STATS');
DELETE FROM yj_role_panel WHERE panel_code IN ('SALE_IN','SALE_IN_DETAIL','SALE_IN_STATS','MATERIAL_RET','MATERIAL_RET_DETAIL','MATERIAL_RET_STATS');
DELETE FROM yj_panel WHERE panel_code IN ('SALE_IN','SALE_IN_DETAIL','SALE_IN_STATS','MATERIAL_RET','MATERIAL_RET_DETAIL','MATERIAL_RET_STATS');
SELECT 'cleaned' AS r;

