SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
CREATE TABLE #r(tbl sysname, col sysname, n int);
DECLARE @t sysname, @c sysname, @q nvarchar(max), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name, c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
  WHERE c.name IN (N'批次号',N'批号',N'lot_no') AND t.is_ms_shipped=0
    AND t.name NOT LIKE N'\_bak\_%' ESCAPE N'\'
  ORDER BY t.name, c.name;
OPEN cur; FETCH NEXT FROM cur INTO @t,@c;
WHILE @@FETCH_STATUS=0 BEGIN
  SET @q = N'SELECT @n=COUNT(*) FROM dbo.' + QUOTENAME(@t) + N' WHERE ISNULL(' + QUOTENAME(@c) + N',N'''')=N''20261014''';
  BEGIN TRY
    EXEC sp_executesql @q, N'@n int OUTPUT', @n OUTPUT;
    IF @n > 0 INSERT #r VALUES(@t,@c,@n);
  END TRY BEGIN CATCH END CATCH;
  FETCH NEXT FROM cur INTO @t,@c;
END
CLOSE cur; DEALLOCATE cur;
SELECT tbl, col, n FROM #r ORDER BY tbl;
GO
