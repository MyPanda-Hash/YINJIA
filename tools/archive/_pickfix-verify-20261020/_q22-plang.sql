SET NOCOUNT ON;
SELECT COUNT(*) AS plang行数, MIN(id) AS 最小id, MAX(id) AS 最大id FROM dbo.plang;
GO
SELECT TOP 5 id, pl_no, pl_xc, mc, BomId, MoDId, ll_no2 FROM dbo.plang ORDER BY id DESC;
GO
SELECT COUNT(*) AS 材料出库行数, MIN(id) AS 最小id, MAX(id) AS 最大id FROM dbo.bl_material_out;
GO
SELECT COUNT(*) AS rid在1_8000内的outh行数 FROM dbo.outh WHERE src = 6 AND rid BETWEEN 1 AND 8000;
