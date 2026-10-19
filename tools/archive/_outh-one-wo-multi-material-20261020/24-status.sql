SET NOCOUNT ON;
SELECT 单据状态, COUNT(*) AS 单数 FROM dbo.bd_material_out GROUP BY 单据状态 ORDER BY 单数 DESC;
SELECT TOP 5 h.单据编号, h.单据状态, COUNT(l.id) AS 行数, MIN(l.批号) AS 批号
  FROM dbo.bd_material_out h JOIN dbo.bl_material_out l ON l.单据编号 = h.单据编号
 WHERE h.单据状态 = N'已审核' GROUP BY h.单据编号, h.单据状态 ORDER BY COUNT(l.id) DESC;
