USE HSDZ_MES; SET NOCOUNT ON;
SELECT c.name AS 列名 FROM sys.columns c WHERE c.object_id = OBJECT_ID('bs_inv') ORDER BY c.column_id;
GO
SELECT TOP 3 * FROM bs_inv WHERE 物料编码 IN (N'T382', N'M-005');
GO
SELECT 物料编码, 物料名称, ISNULL(规格型号,N'(空)') AS 规格型号 FROM bs_inv WHERE 物料编码 IN (N'T382', N'M-005', N'M-001');
GO