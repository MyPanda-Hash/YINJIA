SET NOCOUNT ON;
SELECT t.name, COUNT(c.column_id) AS cols FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bd_transfer','bl_transfer','bd_stocktake','bl_stocktake') GROUP BY t.name ORDER BY t.name;
SELECT panel_code, COUNT(*) n FROM yj_field WHERE panel_code LIKE '%TRANSFER%' OR panel_code LIKE '%STOCKTAKE%' GROUP BY panel_code ORDER BY panel_code;
