-- 探针:找出「真的有 3~4 位小数数据」的明细列(用于挑一张能看出「明细 vs 合计」位数差单据)
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (col sysname, n int);
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql
  + N'INSERT INTO #t SELECT TOP 3 ''' + s.name + N'.' + c.name + N''', COUNT(*) FROM ' + QUOTENAME(s.name)
  + N' WHERE ' + QUOTENAME(c.name) + N' IS NOT NULL AND ' + QUOTENAME(c.name)
  + N' <> ROUND(' + QUOTENAME(c.name) + N', 2) HAVING COUNT(*) > 0;' + CHAR(10)
FROM sys.columns c
JOIN sys.tables s ON s.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE ty.name IN ('decimal', 'numeric') AND c.scale >= 3
  AND (s.name LIKE 'bl[_]%' OR s.name LIKE 'bd[_]%' OR s.name LIKE 'sl[_]%' OR s.name LIKE 'wo[_]%' OR s.name LIKE 'qc[_]%')
ORDER BY s.name, c.name;
EXEC sp_executesql @sql;
GO
SELECT TOP 45 CONCAT(col, ' ×', n) AS hit FROM #t ORDER BY n DESC;
GO
