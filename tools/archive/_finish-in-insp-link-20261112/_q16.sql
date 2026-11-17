SELECT panel_code, mode, line_table, head_table, group_col, prefix FROM yj_panel WHERE panel_code=N'WO_REPORT';
SELECT TOP 3 label, col_name, place, seq FROM yj_field WHERE panel_code=N'WO_REPORT' ORDER BY seq;
