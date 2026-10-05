SET NOCOUNT ON;
GO
SELECT 存货编码, 存货名称, 来料检验 FROM bs_inv WHERE 来料检验 = N'是' ORDER BY 存货编码;
GO
