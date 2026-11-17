SELECT panel_code, panel_name, mode, line_table, head_table, pk_col, code_col, prefix, date_col, config
FROM yj_panel WHERE head_table IS NULL AND mode IN ('doc','archive') ORDER BY mode, panel_code;
