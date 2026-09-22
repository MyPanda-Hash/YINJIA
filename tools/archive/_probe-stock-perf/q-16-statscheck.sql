SET NOCOUNT ON;
SELECT 'ST' AS k, OBJECT_NAME(s.object_id) AS tbl, s.name AS stat, sp.rows, sp.steps
  FROM sys.stats s CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
 WHERE s.name LIKE 'ST[_]%' ORDER BY 2,3;
GO
