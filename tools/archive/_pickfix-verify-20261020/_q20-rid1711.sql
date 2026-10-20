SET NOCOUNT ON;
SELECT id, src, rid, 单据编号, 物料编码, 批号, asp_cancel FROM dbo.outh WHERE src = 6 AND rid = 1711;
GO
SELECT id, src, rid, 单据编号, 物料编码, 批号 FROM dbo.outh WHERE rid BETWEEN 1700 AND 1720 ORDER BY rid;
GO
SELECT COUNT(*) AS MES单据行id大于2000的行数, MIN(id) AS 最小, MAX(id) AS 最大 FROM dbo.bl_material_out;
