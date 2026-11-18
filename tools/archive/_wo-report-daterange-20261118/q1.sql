SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, date_col, page_size, module_group,
       CAST(config AS nvarchar(max)) AS config
FROM yj_panel WHERE panel_code='WO_REPORT_LIST';
GO
SELECT id, panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, ref_panel, ref_field, display_field, dict_sql
FROM yj_field WHERE panel_code='WO_REPORT_LIST' ORDER BY seq, id;
GO
