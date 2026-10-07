SET NOCOUNT ON;
SELECT '表 inv_cost_ledger' AS 对象, COUNT(*) AS 分区行, ISNULL(SUM(p.rows),0) AS 行数
FROM sys.partitions p WHERE p.object_id=OBJECT_ID('dbo.inv_cost_ledger') AND p.index_id IN (0,1)
UNION ALL SELECT '表 kucun', COUNT(*), ISNULL(SUM(p.rows),0) FROM sys.partitions p WHERE p.object_id=OBJECT_ID('dbo.kucun') AND p.index_id IN (0,1)
UNION ALL SELECT '视图 v_stock_ledger', COUNT(*), ISNULL(SUM(p.rows),0) FROM sys.partitions p WHERE p.object_id=OBJECT_ID('dbo.v_stock_ledger') AND p.index_id IN (0,1)
UNION ALL SELECT '视图 v_stock_movement', COUNT(*), ISNULL(SUM(p.rows),0) FROM sys.partitions p WHERE p.object_id=OBJECT_ID('dbo.v_stock_movement') AND p.index_id IN (0,1);
GO
SELECT o.name AS 对象, CASE WHEN m.definition IS NULL THEN N'(无定义文本,表)' ELSE CAST(LEN(m.definition) AS nvarchar(10)) + N' 字符 SQL 文本' END AS 定义
FROM sys.objects o LEFT JOIN sys.sql_modules m ON m.object_id=o.object_id
WHERE o.name IN ('v_stock_ledger','inv_cost_ledger','kucun') ORDER BY 对象;
GO
BEGIN TRY
  EXEC sp_spaceused N'dbo.v_stock_ledger';
  PRINT N'[意外] sp_spaceused 接受了视图';
END TRY
BEGIN CATCH
  SELECT N'sp_spaceused(视图)' AS 尝试, ERROR_NUMBER() AS 错误号, ERROR_MESSAGE() AS 结果;
END CATCH
GO
SELECT 'v_stock_ledger' AS 对象,
       (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.v_stock_ledger')) AS 索引数,
       (SELECT COUNT(*) FROM sys.objects WHERE parent_object_id=OBJECT_ID('dbo.v_stock_ledger') AND type IN ('PK','UQ','F','C','TR','D')) AS 约束触发器数
UNION ALL SELECT 'inv_cost_ledger',
       (SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.inv_cost_ledger')),
       (SELECT COUNT(*) FROM sys.objects WHERE parent_object_id=OBJECT_ID('dbo.inv_cost_ledger') AND type IN ('PK','UQ','F','C','TR','D'));
GO
BEGIN TRY
  SELECT 'inv_cost_ledger 占用KB' AS k, SUM(used_page_count)*8 AS v FROM sys.dm_db_partition_stats WHERE object_id=OBJECT_ID('dbo.inv_cost_ledger')
  UNION ALL SELECT 'v_stock_ledger 占用KB', SUM(used_page_count)*8 FROM sys.dm_db_partition_stats WHERE object_id=OBJECT_ID('dbo.v_stock_ledger');
END TRY
BEGIN CATCH
  SELECT N'页面统计DMV' AS k, N'无权访问(需 VIEW DATABASE STATE)' AS v;
END CATCH
GO
