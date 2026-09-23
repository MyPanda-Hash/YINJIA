SET NOCOUNT ON;
SELECT panel_code, col_name, label, data_type, place, seq, width, hidden, visible, col_group, ref_panel
FROM yj_field WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY','STOCK_BALANCE')
ORDER BY panel_code, seq;
