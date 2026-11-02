SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME IN ('yj_panel','yj_field','yj_role_panel','yj_translation','yj_role')
 ORDER BY TABLE_NAME, ORDINAL_POSITION;
SELECT TOP 3 panel_code, panel_name, panel_name_en, category, mode, line_table, module_group, page_size, date_col, detail_key
  FROM dbo.yj_panel WHERE panel_code IN (N'WO_REPORT_LIST', N'MIX_RECORD');
SELECT TOP 40 col_name, label, label_en, data_type, place, seq, width, visible, hidden, editable, required
  FROM dbo.yj_field WHERE panel_code = N'WO_REPORT_LIST' ORDER BY seq;
SELECT r.id, r.role_name, r.is_admin, p.perms FROM dbo.yj_role r
  LEFT JOIN dbo.yj_role_panel p ON p.role_id = r.id AND p.panel_code = N'WO_REPORT_LIST'
 ORDER BY r.id;
