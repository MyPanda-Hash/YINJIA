SET NOCOUNT ON;
PRINT N'=== A. QC 三面板 ===';
SELECT panel_code, panel_name, category, mode, head_table, line_table, prefix, page_size, detail_key, module_group, config
FROM yj_panel WHERE panel_code IN (N'QC_CATALOG', N'QC_INSP_REC', N'QC_INSP');

PRINT N'=== B. QC_CATALOG 字段 ===';
SELECT id, label, col_name, place, seq, visible, hidden, required, ref_panel, ref_field, width, dict_sql
FROM yj_field WHERE panel_code = N'QC_CATALOG' ORDER BY place, seq, id;

PRINT N'=== C. qc_catalog_detail 物理列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_catalog_detail') ORDER BY c.column_id;

PRINT N'=== D. 目录行统计 ===';
SELECT 检验状态 AS st, COUNT(*) AS n FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 检验状态;

PRINT N'=== E. QC_INSP_REC 物理列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.qc_insp_rec') ORDER BY c.column_id;
