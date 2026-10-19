SET NOCOUNT ON;
SELECT TOP 10 id, RTRIM(wzdm) AS 物料, RTRIM(ckdm) AS 仓库, RTRIM(lot_no) AS 批号, rkl, ckl, yl, update_date
  FROM dbo.kucun WHERE wzdm LIKE N'%TEST-MAT%';
GO
SELECT TOP 10 id, src, rid, 单据编号, 物料编码, 批号, asp_time1 FROM dbo.outh WHERE 物料编码 LIKE N'%TEST-MAT%';
GO
SELECT TOP 5 存货编码, 存货 FROM dbo.bs_inv WHERE 存货编码 LIKE N'%TEST-MAT%';
