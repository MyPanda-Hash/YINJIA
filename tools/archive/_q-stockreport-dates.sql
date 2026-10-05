SET NOCOUNT ON;
SELECT panel_code, col_name, label, data_type, place, seq, required, editable, hidden FROM yj_field
WHERE panel_code IN ('STOCK_LEDGER','STOCK_SUMMARY','STOCK_BALANCE')
  AND (col_name LIKE N'%日期%' OR col_name LIKE N'%期次%' OR col_name LIKE N'%期初%' OR col_name LIKE N'%期末%')
ORDER BY panel_code, seq;
GO
