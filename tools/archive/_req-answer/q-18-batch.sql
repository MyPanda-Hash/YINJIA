SET NOCOUNT ON;
SELECT t.name AS 表名, SUM(p.rows) AS 行数
FROM sys.tables t JOIN sys.partitions p ON p.object_id=t.object_id AND p.index_id IN (0,1)
WHERE t.name LIKE N'%batch%' OR t.name LIKE N'%lot%'
GROUP BY t.name ORDER BY t.name;
GO
