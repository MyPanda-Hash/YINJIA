SET NOCOUNT ON;
SELECT 'bd_purchase_in cols' AS 项, c.name AS 名称 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bd_purchase_in') AND c.name LIKE N'%公司%'
UNION ALL
SELECT 'bl_purchase_in cols', c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bl_purchase_in') AND c.name LIKE N'%公司%'
UNION ALL
SELECT 'bd_finish_in cols', c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bd_finish_in') AND c.name LIKE N'%公司%'
UNION ALL
SELECT 'v_barcode_material cols', c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.v_barcode_material');
SELECT TOP 3 码内容, 存货编码, 批号, 仓库映射, 数量, 单据编号 FROM dbo.v_barcode_material ORDER BY id;
SELECT 'material rows' AS 项, COUNT(*) AS n FROM dbo.v_barcode_material
UNION ALL SELECT 'wip rows', COUNT(*) FROM dbo.v_barcode_wip
UNION ALL SELECT 'fin rows', COUNT(*) FROM dbo.v_barcode_finished;
