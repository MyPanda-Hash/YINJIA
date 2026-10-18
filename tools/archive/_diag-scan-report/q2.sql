SELECT id, label, field_name, place, seq, visible, hidden, ref_panel, ref_field, data_type
FROM dbo.yj_field WHERE panel_code = 'WO_REPORT' ORDER BY seq, id;
