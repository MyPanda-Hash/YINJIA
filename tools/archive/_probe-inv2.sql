USE HSDZ_MES; SET NOCOUNT ON;
SELECT 存货编码, 存货名称, ISNULL(规格型号,N'(空)') AS 规格型号, ISNULL(停用,N'') AS 停用
FROM bs_inv WHERE 存货编码 IN (N'T382', N'M-005', N'M-001', N'T382S');
GO