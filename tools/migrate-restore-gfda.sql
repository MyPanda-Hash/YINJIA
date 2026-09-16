-- migrate-restore-gfda.sql — 恢复被误删的 供应商面板 GFDA(2026-09-16)
-- 事故: 旧版 tools/cleanup-base-panels.sql(801abcc,"大整理"一次性脚本)被重跑,
--       其 DELETE FROM yj_panel/yj_field WHERE panel_code IN ('GFDA','CKDA','YWYDA')
--       删掉了三个面板;磁盘上的该脚本 2026-09-15 已中性化,但库已受损。
--       GFDA 字段行(12 条金蝶可同步口径)被链上后续 kingdee 脚本按 NOT EXISTS 自愈,
--       唯 yj_panel 行无人重建 → 前端「供应商」菜单打开报 面板不存在:GFDA。
-- 修复: ①按兄弟档案(KHDA)模板重建 GFDA 面板行(业务表 dm_gf 及 164 行数据完好);
--       ②连带修复旧系统 入库单RKD/出库单CKD 的「仓库」列悬空参照(CKDA→现行 WH,
--         口径与 BOM/PURCHASE_IN 等 12 处既有 WH 参照一致: 仓库名称/仓库名称)。
--       YWDA(业务员档案)无字段/无菜单/无参照,不重建(重建空面板只会出幽灵面板)。
-- 幂等: 可重复执行。
SET NOCOUNT ON;

-- ══════════ 1. 重建 GFDA 面板行 ══════════
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'GFDA')
  INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en)
  VALUES ('GFDA', N'供应商', N'基础档案', 'archive', 'dm_gf', NULL, NULL, N'id', N'dm', NULL, NULL, 100, N'gfda', N'基础设置', N'Vendor Archive');
GO

-- ══════════ 2. 修复悬空参照(旧系统单据 仓库 列: CKDA → WH) ══════════
UPDATE yj_field SET ref_panel = 'WH', ref_field = N'仓库名称', display_field = N'仓库名称'
WHERE panel_code IN ('RKD', 'CKD') AND col_name = 'ckdm' AND ref_panel = 'CKDA';
GO

-- ══════════ 3. 自检 ══════════
PRINT '=== GFDA 面板行(应 1 行) ===';
SELECT panel_code, panel_name, mode, line_table, detail_key, module_group, panel_name_en FROM yj_panel WHERE panel_code = 'GFDA';
PRINT '=== 字段与表列对齐(缺失列数应为 0) ===';
SELECT COUNT(*) AS missing_line_cols FROM yj_field f
WHERE f.panel_code = 'GFDA' AND f.place LIKE '%detail%' AND COL_LENGTH('dbo.dm_gf', f.col_name) IS NULL;
PRINT '=== 悬空参照(应为 0 行) ===';
SELECT f.panel_code, f.col_name, f.ref_panel FROM yj_field f
WHERE f.ref_panel IS NOT NULL AND f.ref_panel <> '' AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.ref_panel);
PRINT N'migrate-restore-gfda 完成:供应商面板 GFDA 重建 + RKD/CKD 仓库参照改指 WH';
GO
