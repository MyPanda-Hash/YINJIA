SELECT t.name AS 表名,
       CAST(SUM(p.rows) AS int) AS 行数,
       CAST(SUM(a.total_pages) * 8 AS int) AS 总KB,
       CONVERT(nvarchar(19), t.create_date, 120) AS 建表时间,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = MAX(t.object_id)) AS 列数
  FROM sys.tables t
  JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
  JOIN sys.allocation_units a ON a.container_id = p.partition_id
 WHERE t.name LIKE '\_bak\_%' ESCAPE '\'
 GROUP BY t.name, t.create_date
 ORDER BY t.name
GO
