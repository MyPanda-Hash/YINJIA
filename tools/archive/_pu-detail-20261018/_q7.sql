SET NOCOUNT ON;
SELECT TOP 5 码内容, COUNT(*) AS n FROM dbo.v_barcode_material GROUP BY 码内容 HAVING COUNT(*)>1;
PRINT '--- 重复组的明细 ---';
SELECT id, 存货编码, 原始批号, 批号, 单据编号, 单据日期, 批号来源 FROM dbo.v_barcode_material
 WHERE 码内容 IN (SELECT 码内容 FROM dbo.v_barcode_material GROUP BY 码内容 HAVING COUNT(*)>1) ORDER BY 码内容, id;
