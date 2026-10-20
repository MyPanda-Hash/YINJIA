SET NOCOUNT ON;
PRINT '';
SELECT id, pl_no, pl_xc, mc, pl_sl, scx, lot_no, ll_no, ll_no2, lldh, ja, BomId, MoDId
  FROM dbo.plang WHERE pl_no = N'GD-2026-10-0223' ORDER BY pl_xc;
GO
SELECT id, src, rid, 单据编号, 物料编码, 物料名称, 批号, asp_cancel
  FROM dbo.outh WHERE src = 6 AND rid IN (SELECT id FROM dbo.plang WHERE pl_no = N'GD-2026-10-0223');
GO
SELECT id, src, rid, 单据编号, 物料编码, 批号 FROM dbo.inh WHERE rid IN (SELECT id FROM dbo.plang WHERE pl_no = N'GD-2026-10-0223');
GO
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE N'%bom%' OR TABLE_NAME LIKE N'%ll%';
