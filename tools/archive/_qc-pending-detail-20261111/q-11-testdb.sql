SET NOCOUNT ON;
PRINT N'=== 依赖表/视图是否存在(本账套) ===';
SELECT name, type FROM sys.objects WHERE name IN
 (N'qc_insp_rec', N'qc_insp_rec_detail', N'qc_insp', N'qc_insp_detail', N'qc_catalog_detail', N'sl_recv', N'sl_recv_detail', N'bd_purchase_in', N'bl_purchase_in', N'bs_inv', N'v_qc_insp_rec_detail')
ORDER BY name;
PRINT N'=== 目录/记录行数 ===';
SELECT (SELECT COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y') AS recs;
PRINT N'=== QC_CATALOG 面板名 ===';
SELECT panel_code, panel_name, panel_name_en FROM yj_panel WHERE panel_code = N'QC_CATALOG';
