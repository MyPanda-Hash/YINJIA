SET NOCOUNT ON;
SELECT 存货编码, 存货名称, 所属类别, 来料检验, 是否检验, 检验方式 FROM dbo.bs_inv WHERE 来料检验 = N'是' ORDER BY 存货编码;
