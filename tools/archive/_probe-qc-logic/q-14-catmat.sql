SET NOCOUNT ON;
SELECT TOP 3 'A.有类别物料' AS k, 存货编码, 存货名称, 所属类别, 计量单位 FROM bs_inv WHERE 所属类别 = N'折叠棉' ORDER BY id;
GO
