SET NOCOUNT ON;
SELECT '面板' AS k, panel_code, panel_name, mode, line_table, head_table, group_col FROM yj_panel
 WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','STOCK_STATUS') OR line_table IN ('v_stock_balance','v_stock_ledger','v_stock_summary','kucun');
GO
