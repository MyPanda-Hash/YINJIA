SET NOCOUNT ON;
SELECT * FROM yj_panel WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY','STOCK_BALANCE','STOCK_STATUS');
GO
SELECT panel_code, place, seq, col_name, label, data_type, ISNULL(ref_panel,'') AS rp, ISNULL(ref_field,'') AS rf, hidden, visible
FROM yj_field WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY','STOCK_BALANCE','STOCK_STATUS')
ORDER BY panel_code, place, seq;
GO
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY','STOCK_BALANCE','STOCK_STATUS') GROUP BY panel_code;
GO
SELECT TOP 20 * FROM yj_report_template WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY','STOCK_BALANCE','STOCK_STATUS');
GO
