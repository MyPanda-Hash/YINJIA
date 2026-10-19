SET NOCOUNT ON;
PRINT N'== 文本型「库存数量」的实际取值样本(material_out) ==';
SELECT TOP 12 单据编号, 材料名称, 计量单位, 数量, 库存数量, 现存量, 现存量说明
FROM dbo.bl_material_out WHERE NULLIF(LTRIM(RTRIM(库存数量)),N'') IS NOT NULL ORDER BY id DESC;

PRINT N'== 各单据行「现存量」填写率 ==';
SELECT N'bl_purchase_in' AS 表, COUNT(*) AS 行数, COUNT(现存量) AS 已填, CAST(MIN(现存量) AS decimal(18,4)) AS 最小, CAST(MAX(现存量) AS decimal(18,4)) AS 最大 FROM dbo.bl_purchase_in
UNION ALL SELECT N'bl_sale_out', COUNT(*), COUNT(现存量), CAST(MIN(现存量) AS decimal(18,4)), CAST(MAX(现存量) AS decimal(18,4)) FROM dbo.bl_sale_out
UNION ALL SELECT N'bl_material_out', COUNT(*), COUNT(现存量), CAST(MIN(现存量) AS decimal(18,4)), CAST(MAX(现存量) AS decimal(18,4)) FROM dbo.bl_material_out
UNION ALL SELECT N'bl_finish_in', COUNT(*), COUNT(现存量), CAST(MIN(现存量) AS decimal(18,4)), CAST(MAX(现存量) AS decimal(18,4)) FROM dbo.bl_finish_in
UNION ALL SELECT N'bl_pu_order', COUNT(*), COUNT(现存量), CAST(MIN(现存量) AS decimal(18,4)), CAST(MAX(现存量) AS decimal(18,4)) FROM dbo.bl_pu_order;
