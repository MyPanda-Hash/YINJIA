SET NOCOUNT ON;
PRINT '== yj_report_template 的列 ==';
SELECT c.column_id, c.name AS col, t.name AS typ,
       CASE WHEN t.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS len
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_report_template') ORDER BY c.column_id;

PRINT '== 全库哪些表有 形如 report_template 的名字 ==';
SELECT s.name AS sch, o.name AS tbl, o.type_desc FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.name LIKE N'%report_template%';
GO
