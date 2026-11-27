SELECT panel_code, id, seq, label, col_name, data_type, place, visible, hidden, editable, required
FROM yj_field WHERE label LIKE N'%特采%' ORDER BY panel_code, seq, id;
GO
SELECT panel_code, id, seq, label, col_name, data_type, place, visible, hidden, editable, required
FROM yj_field WHERE panel_code IN (N'QC_INSP_REC') ORDER BY seq, id;
GO
SELECT panel_code, id, seq, label, col_name, data_type, place, visible, hidden, editable, required
FROM yj_field WHERE panel_code IN (N'QC_TC_IN') ORDER BY seq, id;
