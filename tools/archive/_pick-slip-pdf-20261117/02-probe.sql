SET NOCOUNT ON;
SELECT TOP 20 'wo_pick_doc' AS t, id, 工单号, 工单行号, 领料单号, 领料类型, 状态 FROM dbo.wo_pick_doc WHERE 工单号 LIKE N'%0009%' ORDER BY id DESC;
GO
SELECT TOP 10 'plang' AS t, * FROM dbo.plang WHERE 工单号 LIKE N'%GD-2026-11-0009%';
GO
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.plang') ORDER BY c.column_id;
