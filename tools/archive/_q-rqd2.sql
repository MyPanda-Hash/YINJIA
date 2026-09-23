SET NOCOUNT ON;
GO
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'yj_panel') ORDER BY c.column_id;
GO
SELECT panel_code, report_query_dialog FROM yj_panel WHERE panel_code IN (N'STOCK_LEDGER',N'STOCK_SUMMARY',N'STOCK_BALANCE');
GO
