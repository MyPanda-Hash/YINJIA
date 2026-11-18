SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, line_table, page_size, config FROM yj_panel WHERE panel_code='WO_COMPLETION_LIST';
GO
SELECT panel_code, col_name, label, data_type, place, seq FROM yj_field WHERE panel_code='WO_COMPLETION_LIST' AND data_type=N'数值';
GO
