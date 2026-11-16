SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, detail_key, module_group, config
FROM yj_panel WHERE panel_code IN (N'QC_CATALOG', N'QC_LINE_PATROL', N'QC_INSP');
SELECT '=== fields QC_CATALOG ===' AS x;
SELECT id, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, alias, dict_sql, ref_panel, ref_field, display_field, ref_filter, tab_key
FROM yj_field WHERE panel_code=N'QC_CATALOG' ORDER BY place, seq, id;
