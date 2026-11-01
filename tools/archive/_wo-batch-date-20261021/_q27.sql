SET NOCOUNT ON;
SELECT panel_code, label, col_name, place, seq, visible, hidden, editable FROM yj_field
WHERE panel_code IN ('WO_REPORT','WO_REPORT_LIST') AND (col_name IN ('批次号','lot_no') OR label LIKE N'%批%')
ORDER BY panel_code, seq;
GO
