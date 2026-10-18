SET NOCOUNT ON;
SELECT TOP 3 * FROM v_stock_pick;
SELECT COUNT(*) AS pick_rows FROM v_stock_pick;
SELECT panel_code, COUNT(*) n FROM yj_field WHERE panel_code IN ('STOCK_PICK','TRANSFER','STOCKTAKE') GROUP BY panel_code;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_transfer') AND name IN (N'附件1',N'调拨原因',N'ERP单号',N'是否已转ERP');
