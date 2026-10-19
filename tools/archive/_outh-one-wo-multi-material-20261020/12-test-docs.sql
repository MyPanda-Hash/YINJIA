SET NOCOUNT ON;
SELECT TOP 10 h.单据编号, h.单据状态, h.加工单号, h.asp_cancel, COUNT(l.id) AS 行数,
       MIN(l.材料编码) AS 物料1, MIN(l.批号) AS 批号1
  FROM dbo.bd_material_out h LEFT JOIN dbo.bl_material_out l ON l.单据编号 = h.单据编号
 GROUP BY h.单据编号, h.单据状态, h.加工单号, h.asp_cancel
 ORDER BY h.单据编号 DESC;
