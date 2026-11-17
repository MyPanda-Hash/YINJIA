SELECT TOP 30 panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, detail_key, module_group
FROM yj_panel
WHERE module_group = N'品质管理' OR panel_code IN (N'QC_CATALOG',N'QC_INSP',N'QC_LINE_PATROL',N'QC_OQC_REPORT')
ORDER BY panel_code;
