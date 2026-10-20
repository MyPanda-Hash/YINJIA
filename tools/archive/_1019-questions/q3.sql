SELECT panel_code, panel_name, category, module_group, mode, head_table, line_table, prefix
FROM yj_panel WHERE panel_code LIKE 'QC%' OR module_group LIKE '%采购%' OR category LIKE '%采购%' OR category LIKE '%品质%' OR module_group LIKE '%品质%'
ORDER BY module_group, category, seq
GO
SELECT DISTINCT category, module_group FROM yj_panel ORDER BY module_group, category
