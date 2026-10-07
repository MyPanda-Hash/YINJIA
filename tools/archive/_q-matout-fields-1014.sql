SET NOCOUNT ON;
SELECT id, col_name, label, data_type, required, place, hidden, visible, seq, ref_panel, ref_field, tab_key, alias
FROM yj_field WHERE panel_code='MATERIAL_OUT' ORDER BY place, seq, id;
