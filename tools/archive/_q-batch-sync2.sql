SET NOCOUNT ON;
PRINT '== 视图批号占位统计 ==';
SELECT TOP 8 批号, COUNT(*) AS n FROM v_stock_movement GROUP BY 批号 ORDER BY n DESC;
PRINT '== bl_purchase_in 批类列 ==';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bl_purchase_in') AND (c.name LIKE N'%批%' OR c.name LIKE N'%lot%');
GO
