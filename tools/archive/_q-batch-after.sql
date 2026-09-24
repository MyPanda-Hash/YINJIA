SET NOCOUNT ON;
SELECT TOP 8 批号, COUNT(*) AS n FROM v_stock_movement GROUP BY 批号 ORDER BY n DESC;
SELECT COUNT(*) AS 仍是未填占位 FROM v_stock_movement WHERE 批号 = N'(未填批号)';
GO
