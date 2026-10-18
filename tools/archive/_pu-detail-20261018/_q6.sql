SET NOCOUNT ON;
SELECT '码内容为空-材料' AS 项, COUNT(*) AS n FROM dbo.v_barcode_material WHERE ISNULL(码内容,'')=''
UNION ALL SELECT '码内容重复-材料', COUNT(*) FROM (SELECT 码内容 FROM dbo.v_barcode_material GROUP BY 码内容 HAVING COUNT(*)>1) x
UNION ALL SELECT '码内容为空-成品', COUNT(*) FROM dbo.v_barcode_finished WHERE ISNULL(码内容,'')=''
UNION ALL SELECT '码内容重复-成品', COUNT(*) FROM (SELECT 码内容 FROM dbo.v_barcode_finished GROUP BY 码内容 HAVING COUNT(*)>1) y;
