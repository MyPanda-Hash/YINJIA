SET NOCOUNT ON;
SELECT 存货编码, 存货名称, 规格型号, 计量单位 FROM dbo.bs_inv WHERE 存货编码 IN (N'YJ-KG-C12', N'YJ-HKK-007');
