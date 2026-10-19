SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#dup') IS NOT NULL DROP TABLE #dup;
CREATE TABLE #dup (panel sysname, tbl sysname, col sysname, no nvarchar(100), n int, mn date NULL, mx date NULL);
DECLARE @p sysname, @t sysname, @c sysname, @d date, @sql nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT panel_code, CASE WHEN head_table IS NOT NULL THEN head_table ELSE line_table END, group_col
  FROM yj_panel WHERE group_col IS NOT NULL AND (head_table IS NOT NULL OR line_table IS NOT NULL);
OPEN cur FETCH NEXT FROM cur INTO @p, @t, @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(@t) IS NOT NULL AND COL_LENGTH(@t, @c) IS NOT NULL
  BEGIN
    SET @sql = N'INSERT INTO #dup (panel,tbl,col,no,n) SELECT @p, @t, @c, CAST(x.[' + @c + N'] AS nvarchar(100)), COUNT(*) FROM [' + @t + N'] x GROUP BY x.[' + @c + N'] HAVING COUNT(*)>1;';
    EXEC sp_executesql @sql, N'@p sysname, @t sysname, @c sysname', @p, @t, @c;
  END
  FETCH NEXT FROM cur INTO @p, @t, @c;
END
CLOSE cur DEALLOCATE cur;
SELECT panel, tbl, col, COUNT(*) AS dup_numbers, SUM(n) AS rows_involved FROM #dup GROUP BY panel, tbl, col ORDER BY dup_numbers DESC;
