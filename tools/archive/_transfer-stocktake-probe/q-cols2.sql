SET NOCOUNT ON;
SELECT t.name, COUNT(c.column_id) AS cols FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bd_transfer','bl_transfer','bd_stocktake','bl_stocktake') GROUP BY t.name ORDER BY t.name;
SELECT COUNT(*) AS transfer_fields FROM yj_field WHERE panel_code='TRANSFER';
SELECT COUNT(*) AS stocktake_fields FROM yj_field WHERE panel_code='STOCKTAKE';
SELECT COUNT(*) AS pick_fields FROM yj_field WHERE panel_code='STOCK_PICK';
