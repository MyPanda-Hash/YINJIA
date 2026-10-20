SET NOCOUNT ON;
GO
SELECT DB_NAME() AS 库,
       CASE WHEN OBJECT_ID('dbo.bs_supplier') IS NULL THEN N'不存在' ELSE N'存在' END AS bs_supplier,
       CASE WHEN OBJECT_ID('dbo.dm_gf') IS NULL THEN N'不存在' ELSE N'存在' END AS dm_gf,
       CASE WHEN OBJECT_ID('dbo.bs_wh') IS NULL THEN N'不存在' ELSE N'存在' END AS bs_wh;
GO
