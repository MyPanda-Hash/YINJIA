SET NOCOUNT ON;
SELECT seq, col_name, label, label_en, data_type, place, width, visible, hidden, editable
  FROM dbo.yj_field WHERE panel_code = N'WO_MIXING_LIST' ORDER BY seq, id;
SELECT panel_code, panel_name, panel_name_en, category, mode, line_table, date_col, page_size, module_group, detail_key
  FROM dbo.yj_panel WHERE panel_code = N'WO_MIXING_LIST';
