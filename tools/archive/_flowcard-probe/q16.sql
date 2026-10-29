SET NOCOUNT ON;
SELECT name, TYPE_NAME(user_type_id) t, max_length FROM sys.columns WHERE object_id=OBJECT_ID('dbo.plang') AND (name LIKE N'%批次%' OR name LIKE N'%工艺%' OR name LIKE N'%工序%' OR name LIKE N'%状态%' OR name LIKE N'%完工%' OR name LIKE N'%产线%' OR name LIKE N'%线%') ORDER BY column_id;
PRINT '--- sample recent plang 批次/路线 ---';
SELECT TOP 6 id, pl_no, pl_xc, lot_no, [批次号], [工艺路线], [当前工序], [完工状态], scx FROM plang ORDER BY id DESC;
PRINT '--- distinct lot_no count ---';
SELECT COUNT(DISTINCT lot_no) batches, MIN(lot_no) mn, MAX(lot_no) mx FROM plang WHERE ISNULL(lot_no,'')<>'';
