SET NOCOUNT ON;
SELECT DB_NAME() AS db;
SELECT o.name AS obj, o.type_desc, o.create_date, o.modify_date
  FROM sys.objects o
 WHERE o.name LIKE '%outh%' OR o.name LIKE '%cing%' OR o.name LIKE '%pick%'
 ORDER BY o.name;
SELECT t.name AS tbl, p.rows, CAST(SUM(a.total_pages) * 8.0 / 1024 AS decimal(10,1)) AS mb
  FROM sys.tables t
  JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
  JOIN sys.allocation_units a ON a.container_id = p.partition_id
 WHERE t.name IN (N'outh', N'outh_detail', N'outhd', N'inh', N'kucun', N'mate')
 GROUP BY t.name, p.rows;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable, c.is_identity,
       CAST(ep.value AS nvarchar(400)) AS cmt
  FROM sys.columns c
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.outh')
 ORDER BY c.column_id;
