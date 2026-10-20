SELECT panel_code, label, col_name, place FROM yj_field
WHERE panel_code IN ('STOCK_DETAIL','STOCK_STATUS','STOCK_LEDGER','STOCK_SUMMARY')
  AND (label LIKE N'%仓库%' OR label LIKE N'%存货%')
ORDER BY panel_code, seq, id
GO
SELECT panel_code, panel_name, line_table, mode FROM yj_panel WHERE panel_code IN ('STOCK_DETAIL','STOCK_STATUS','STOCK_LEDGER','STOCK_SUMMARY')
