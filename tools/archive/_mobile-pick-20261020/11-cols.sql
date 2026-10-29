SET NOCOUNT ON;
SELECT OBJECT_NAME(c.object_id) AS 表, c.name AS 列 FROM sys.columns c
 WHERE c.object_id IN (OBJECT_ID('dbo.bd_material_out'), OBJECT_ID('dbo.bl_material_out'))
   AND c.name IN (N'工单行号', N'加工单号', N'仓位编码', N'仓位名称', N'批次号', N'仓库编码');
