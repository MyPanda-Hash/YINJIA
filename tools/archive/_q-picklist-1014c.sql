-- _q-picklist-1014c.sql — 探针 v3:材料出库单表头字段 + 数据实况(只读)
SET NOCOUNT ON;
PRINT '=== 1) MATERIAL_OUT 表头字段 ===';
SELECT seq, label, col_name, data_type, ref_panel, ref_field, required
FROM yj_field WHERE panel_code = N'MATERIAL_OUT' AND place LIKE N'%header%' ORDER BY seq, id;

PRINT '=== 2) 行数 ===';
SELECT (SELECT COUNT(*) FROM bd_material_out) AS 头, (SELECT COUNT(*) FROM bl_material_out) AS 行;

PRINT '=== 3) 最近 5 张材料出库单(全部列名值) ===';
SELECT TOP 5 * FROM bd_material_out ORDER BY id DESC;

PRINT '=== 4) 最近 10 行明细 ===';
SELECT TOP 10 单据编号, 行号, 材料编码, 材料名称, 数量, 仓库, 批号 FROM bl_material_out ORDER BY id DESC;

PRINT '=== 5) plang 领料单号回填 ===';
SELECT COUNT(*) AS 工单行数, SUM(CASE WHEN ISNULL(ll_no2,N'')<>N'' THEN 1 ELSE 0 END) AS 已回填领料单号 FROM plang;
SELECT TOP 3 pl_no, pl_xc, dm, mc, pl_sl, ll_no2 FROM plang WHERE ISNULL(ll_no2,N'') <> N'' ORDER BY id DESC;

PRINT '=== 6) BOM 表 mate 与 bs_bom ===';
SELECT (SELECT COUNT(*) FROM dbo.mate) AS mate行数;
SELECT CASE WHEN OBJECT_ID(N'dbo.bs_bom') IS NULL THEN N'已删' ELSE N'仍在' END AS bs_bom;
SELECT * FROM yj_panel WHERE panel_code IN (N'WLBOM', N'MATERIAL_OUT', N'MANU_ORDER', N'WO_ORDER', N'RD_MOLD_PROC');

PRINT '=== 7) mate 列 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.mate') ORDER BY c.column_id;
