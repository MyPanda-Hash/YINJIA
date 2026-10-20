SELECT TOP 20 m.name FROM sys.columns m WHERE m.object_id=OBJECT_ID('dbo.yj_field') ORDER BY m.column_id
GO
SELECT panel_code, seq, label, place, visible, hidden, required, editable, ref_panel, ref_field, col_name
FROM yj_field WHERE panel_code IN ('QC_TC_IN') ORDER BY seq, id
