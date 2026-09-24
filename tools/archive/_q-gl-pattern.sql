SET NOCOUNT ON;
SELECT TOP 6 存货编码, 存货名称, 规格型号 FROM bs_inv WHERE 存货编码 LIKE N'Y-GL%' OR 存货名称 LIKE N'%硅胶粉%';
GO
