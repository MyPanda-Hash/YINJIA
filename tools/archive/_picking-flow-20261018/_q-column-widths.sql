SET NOCOUNT ON;
PRINT '=== 所有带 ll_no2 列的表及宽度 ==='
SELECT OBJECT_SCHEMA_NAME(c.object_id) AS sch, OBJECT_NAME(c.object_id) AS tbl, c.name, c.max_length,
       t.name AS type, c.max_length/2 AS chars
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.name=N'll_no2' AND OBJECTPROPERTY(c.object_id,'IsUserTable')=1
ORDER BY tbl;
GO
PRINT '=== plang_pc 全部 nvarchar(30) 及以下列(可能被回写截断) ==='
SELECT c.name, c.max_length, t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.plang_pc') AND t.name='nvarchar' AND c.max_length<=60 ORDER BY c.name;
GO
