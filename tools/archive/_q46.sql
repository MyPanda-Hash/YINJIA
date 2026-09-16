SET NOCOUNT ON;
SELECT t.name, c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bl_finish_in','bl_material_out','bl_outsource_in','bl_outsource_issue')
  AND (c.name LIKE N'%存货%' OR c.name LIKE N'%物料%' OR c.name LIKE N'%仓库%' OR c.name LIKE N'%数量%' OR c.name LIKE N'%金额%' OR c.name LIKE N'%单位%' OR c.name LIKE N'%规格%')
ORDER BY t.name, c.column_id;
