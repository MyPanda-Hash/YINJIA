SET NOCOUNT ON;
GO
SELECT panel_code, col_name, data_type, place, visible FROM yj_field
 WHERE panel_code IN (N'STOCK_SUMMARY', N'STOCK_LEDGER', N'STOCK_BALANCE')
 ORDER BY panel_code, seq;
GO
