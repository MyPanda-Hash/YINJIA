SET NOCOUNT ON;
UPDATE qc_catalog_detail SET 数量 = N'51Kg' WHERE 批次号 = N'260807';
SELECT 检测物料类别, 物料名称, 批次号, 数量 FROM qc_catalog_detail;
GO
