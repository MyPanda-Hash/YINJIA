SELECT panel_code, place, COUNT(*) AS n FROM yj_field WHERE panel_code IN (N'INV', N'QC_INSP_REQ', N'BS_QC_ITEM', N'QC_ITEM', N'WHLOC', N'ZDGL') GROUP BY panel_code, place ORDER BY panel_code, place;
SELECT '=== INV sample ===' AS x;
SELECT id, col_name, label, data_type, place, seq, width, editable, required, hidden, visible FROM yj_field WHERE panel_code=N'INV' ORDER BY id;
