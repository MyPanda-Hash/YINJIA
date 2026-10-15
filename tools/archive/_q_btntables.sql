SET NOCOUNT ON;
PRINT '== 相关表 ==';
SELECT s.name AS sch, o.name AS tbl FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type = 'U' AND (o.name LIKE N'%button%' OR o.name LIKE N'%btn%' OR o.name LIKE N'%panel%') ORDER BY o.name;
GO
PRINT '== yj_panel_button 列 ==';
SELECT c.name AS col, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel_button') ORDER BY c.column_id;
GO
