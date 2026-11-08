SET NOCOUNT ON;
PRINT '=== A. fixture restored? ===';
SELECT 单据编号, 产品编码 FROM dbo.qc_proc_insp_head WHERE 单据编号 = N'ZC-2026-10-0033';
PRINT '=== B. old panel name residue ===';
SELECT COUNT(*) AS old_name_panels FROM dbo.yj_panel WHERE panel_name = N'制程检验单';
SELECT panel_code, panel_name, panel_name_en FROM dbo.yj_panel WHERE panel_code = N'QC_PROC_INSP';
PRINT '=== C. migration log ===';
SELECT script_name FROM dbo.yj_schema_log WHERE script_name LIKE N'%20261109%' ORDER BY script_name;
