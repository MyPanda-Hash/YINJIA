SET NOCOUNT ON;
SELECT COUNT(*) AS 流水行数,
       SUM(CASE WHEN 仓库编码 IS NULL THEN 1 ELSE 0 END) AS 无仓库编码行,
       SUM(CASE WHEN 仓库键 LIKE N'#%' THEN 1 ELSE 0 END) AS 走#兜底行,
       SUM(CASE WHEN 批号 = N'(未填批号)' THEN 1 ELSE 0 END) AS 未填批号行,
       SUM(CASE WHEN 存货编码 = N'(未填存货)' THEN 1 ELSE 0 END) AS 未填存货行
FROM v_stock_movement;
GO
SELECT COUNT(DISTINCT 仓库键) AS 仓库键数, COUNT(DISTINCT 仓库) AS 仓库名称数 FROM v_stock_movement;
GO
