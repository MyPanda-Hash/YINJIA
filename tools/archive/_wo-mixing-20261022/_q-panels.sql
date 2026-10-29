SET NOCOUNT ON;
SELECT * FROM dbo.yj_panel WHERE panel_code IN ('WO_REPORT_LIST','WO_COMPLETION_LIST');
SELECT panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, ref_panel, ref_field, dict_sql, label_en
FROM dbo.yj_field WHERE panel_code IN ('WO_REPORT_LIST','WO_COMPLETION_LIST') ORDER BY panel_code, seq;
