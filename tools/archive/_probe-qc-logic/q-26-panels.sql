SET NOCOUNT ON;
SELECT 'A.用视图的面板' AS k, panel_code, panel_name, mode, ISNULL(line_table,'-') AS line_table, ISNULL(head_table,'-') AS head_table
  FROM yj_panel WHERE line_table IN ('v_stock_balance','v_stock_ledger','v_stock_movement') OR head_table IN ('v_stock_balance','v_stock_ledger') OR panel_code IN ('STOCK_STATUS','STOCK_LEDGER','STOCK_SUMMARY');
SELECT 'B.kucun' AS k, (SELECT COUNT(*) FROM kucun) AS rows_n, (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('kucun')) AS cols_n;
GO
