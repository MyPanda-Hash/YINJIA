SELECT panel_code, panel_name, category, module_group, head_table, line_table, prefix FROM yj_panel
WHERE panel_name LIKE N'%不合格品%' OR panel_name LIKE N'%不良%' ORDER BY panel_code;
GO
SELECT panel_code, seq, label, col_name, data_type, place, visible, hidden FROM yj_field
WHERE panel_code IN (SELECT panel_code FROM yj_panel WHERE panel_name LIKE N'%不合格品%')
ORDER BY panel_code, seq;
