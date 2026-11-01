SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#dbg') IS NOT NULL DROP TABLE #dbg;
CREATE TABLE #dbg(t sysname, info nvarchar(200));
DECLARE @t sysname, @oid int, @cols nvarchar(max);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t WHERE t.name IN (N'plang',N'scjl',N'bd_material_out',N'wo_progress');
OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS=0 BEGIN
  SET @oid = OBJECT_ID(N'dbo.'+QUOTENAME(@t));
  SELECT @cols = STUFF((SELECT N' OR x.' + QUOTENAME(c.name) + N'=m.old_no'
                        FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                        WHERE c.object_id=@oid AND ty.name IN ('nvarchar','varchar','nchar','char')
                        FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 4, '');
  INSERT #dbg VALUES(@t, CONCAT('oid=',@oid,' cols_len=',ISNULL(LEN(@cols),-1)));
  FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;
SELECT * FROM #dbg;
GO
