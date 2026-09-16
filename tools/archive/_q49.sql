SET NOCOUNT ON;
SELECT t.name, c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bl_finish_in','bl_outsource_in','bl_material_out','bl_outsource_issue')
  AND (c.name LIKE N'%物料%' OR c.name LIKE N'%产品%' OR c.name LIKE N'%编码%' OR c.name LIKE N'%名称%' OR c.name LIKE N'%wzdm%')
ORDER BY t.name, c.column_id;
