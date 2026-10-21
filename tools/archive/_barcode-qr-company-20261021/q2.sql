SET NOCOUNT ON;
SELECT TOP 5 存货编码, 批号, 码内容, 存货名称, 数量, 计量单位, 单据编号, 单据日期, 仓库映射, 供应商
FROM dbo.v_barcode_material
WHERE ISNULL(存货编码,'') <> '' AND ISNULL(批号,'') <> ''
ORDER BY id;
