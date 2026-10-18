SET NOCOUNT ON;
SELECT panel_code, seq, label, col_name, data_type, ref_panel, ref_field, display_field, ref_filter, place, visible, hidden
FROM yj_field WHERE panel_code IN ('TRANSFER','STOCKTAKE') AND label LIKE N'%仓位%' ORDER BY panel_code, seq;
