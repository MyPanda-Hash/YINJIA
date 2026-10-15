/* q-21-colnames.sql — 期初行要用到的档案列名(只读) */
SET NOCOUNT ON;
GO
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_inv')
  AND c.name IN (N'存货编码', N'存货名称', N'规格型号', N'主计量', N'主计量单位', N'计量单位', N'物料编码', N'物料名称') ORDER BY c.column_id;
GO
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bs_wh')
  AND c.name IN (N'仓库编码', N'仓库名称') ORDER BY c.column_id;
GO
SELECT TOP 3 存货编码, 存货名称, 规格型号, 主计量 FROM dbo.bs_inv;
GO
