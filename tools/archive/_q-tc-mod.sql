SET NOCOUNT ON;
PRINT '=== QC_INSP / QC_TC 注册口径 ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, prefix, date_col, module_group
FROM yj_panel WHERE panel_code IN ('QC_INSP','QC_TC','QC_RETURN','QC_RECV');
GO
PRINT '=== 已用 prefix(TC 前缀重复?) ===';
SELECT panel_code, prefix FROM yj_panel WHERE prefix LIKE 'TC%' OR prefix LIKE 'T%';
GO
PRINT '=== module_group 全部取值 ===';
SELECT DISTINCT module_group FROM yj_panel ORDER BY module_group;
GO
