SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m;
SELECT DISTINCT p.pl_no AS old_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) AS new_no INTO #m FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
IF OBJECT_ID('tempdb..#hits') IS NOT NULL DROP TABLE #hits;
CREATE TABLE #hits(tbl sysname, n int);
DECLARE @t sysname, @cols nvarchar(max), @q nvarchar(max), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t WHERE t.is_ms_shipped=0 AND t.name NOT LIKE N'[_]bak[_]%'
    AND EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                WHERE c.object_id=t.object_id AND ty.name IN ('nvarchar','varchar','nchar','char'));
OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS=0 BEGIN
  SELECT @cols = STUFF((SELECT N' OR x.' + QUOTENAME(c.name) + N'=m.old_no'
                        FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                        WHERE c.object_id=OBJECT_ID(N'dbo.'+QUOTENAME(@t)) AND ty.name IN ('nvarchar','varchar','nchar','char')
                        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 4, '');
  IF @cols IS NOT NULL BEGIN
    SET @q = N'SELECT @n=COUNT(*) FROM dbo.' + QUOTENAME(@t) + N' x JOIN #m m ON ' + @cols;
    BEGIN TRY
      EXEC sp_executesql @q, N'@n int OUTPUT', @n OUTPUT;
      IF @n > 0 INSERT #hits VALUES(@t, @n);
    END TRY BEGIN CATCH END CATCH;
  END
  FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
SELECT tbl, n FROM #hits ORDER BY n DESC;
GO
