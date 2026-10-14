-- _clean-other-docs.sql — 一次性清理(2026-10-14,链外,不进清单)
-- 用途:Phase 2 首次执行 migrate-other-docs-rebuild-20261014.sql 时因统计视图 GROUP BY 缺 仓库、
--   以及表头/明细「备注」同标签冲突而**部分落库**,本脚本把测试账套里的半成品清干净后重跑迁移。
-- ⚠ 仅用于**测试账套**(HSDZ_MES_TEST);正式账套从未执行过失败的那版,无需清理。
SET NOCOUNT ON;
IF OBJECT_ID('dbo.v_other_in_detail','V')  IS NOT NULL DROP VIEW dbo.v_other_in_detail;
IF OBJECT_ID('dbo.v_other_in_stats','V')   IS NOT NULL DROP VIEW dbo.v_other_in_stats;
IF OBJECT_ID('dbo.v_other_out_detail','V') IS NOT NULL DROP VIEW dbo.v_other_out_detail;
IF OBJECT_ID('dbo.v_other_out_stats','V')  IS NOT NULL DROP VIEW dbo.v_other_out_stats;
IF OBJECT_ID('dbo.bl_other_in','U')  IS NOT NULL DROP TABLE dbo.bl_other_in;
IF OBJECT_ID('dbo.bd_other_in','U')  IS NOT NULL DROP TABLE dbo.bd_other_in;
IF OBJECT_ID('dbo.bl_other_out','U') IS NOT NULL DROP TABLE dbo.bl_other_out;
IF OBJECT_ID('dbo.bd_other_out','U') IS NOT NULL DROP TABLE dbo.bd_other_out;
DELETE FROM yj_role_panel WHERE panel_code IN ('OTHER_IN','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT','OTHER_OUT_DETAIL','OTHER_OUT_STATS');
DELETE FROM yj_field      WHERE panel_code IN ('OTHER_IN','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT','OTHER_OUT_DETAIL','OTHER_OUT_STATS');
DELETE FROM yj_panel      WHERE panel_code IN ('OTHER_IN','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT','OTHER_OUT_DETAIL','OTHER_OUT_STATS');
PRINT N'其他入库/出库 半成品已清理';
