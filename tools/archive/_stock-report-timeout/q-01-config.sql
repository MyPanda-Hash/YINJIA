/* q-01-config.sql — 库存报表三面版:配置与数据量(只读) */
SET NOCOUNT ON;
GO
SELECT panel_code, panel_name, mode, line_table, date_col, page_size, module_group
FROM yj_panel WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS');
GO
SELECT 'v_stock_balance' AS obj, COUNT(*) AS rows_n FROM v_stock_balance
UNION ALL SELECT 'v_stock_ledger', COUNT(*) FROM v_stock_ledger
UNION ALL SELECT 'v_stock_summary', COUNT(*) FROM v_stock_summary
UNION ALL SELECT 'kucun', COUNT(*) FROM kucun;
GO
SELECT f.panel_code, f.seq, f.label, f.col, f.place, f.visible, f.hidden
FROM yj_field f WHERE f.panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY')
ORDER BY f.panel_code, f.seq;
GO
