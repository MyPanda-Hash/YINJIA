SET NOCOUNT ON;
SELECT t.name AS tbl, c.column_id, c.name, TYPE_NAME(c.user_type_id) AS dtype, c.max_length, c.is_nullable,
       ISNULL(ep.value,'') AS descr
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description'
WHERE t.name IN ('wo_mixing_head','wo_mixing_detail') ORDER BY t.name, c.column_id;
SELECT 'head rows' k, COUNT(*) n FROM dbo.wo_mixing_head UNION ALL SELECT 'detail rows', COUNT(*) FROM dbo.wo_mixing_detail;
