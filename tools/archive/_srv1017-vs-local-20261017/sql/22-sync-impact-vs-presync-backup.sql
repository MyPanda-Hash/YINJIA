SET NOCOUNT ON;
/* 本次同步到底改了本地什么:施工前备份库 vs 现在的本地库,逐表 EXCEPT 双向 */
IF OBJECT_ID('tempdb..#d') IS NOT NULL DROP TABLE #d;
CREATE TABLE #d (tbl sysname, pre bigint, now_rows bigint, added bigint, removed bigint, note nvarchar(150));
DECLARE @t sysname, @sql nvarchar(max), @a bigint, @r bigint, @p bigint, @c bigint;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT s.name + '.' + t.name FROM HSDZ_MES.sys.tables t
  JOIN HSDZ_MES.sys.schemas s ON s.schema_id = t.schema_id WHERE t.is_ms_shipped = 0 ORDER BY t.name;
OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @a = NULL; SET @r = NULL; SET @p = 0; SET @c = 0;
  BEGIN TRY
    SET @sql = N'SELECT @p = COUNT_BIG(*) FROM HSDZ_MES_PRESYNC1017.' + @t + N';
                SELECT @c = COUNT_BIG(*) FROM HSDZ_MES.' + @t + N';';
    EXEC sp_executesql @sql, N'@p bigint OUTPUT, @c bigint OUTPUT', @p OUTPUT, @c OUTPUT;
    SET @sql = N'SELECT @a = COUNT_BIG(*) FROM (SELECT * FROM HSDZ_MES.' + @t + N' EXCEPT SELECT * FROM HSDZ_MES_PRESYNC1017.' + @t + N') x;
                SELECT @r = COUNT_BIG(*) FROM (SELECT * FROM HSDZ_MES_PRESYNC1017.' + @t + N' EXCEPT SELECT * FROM HSDZ_MES.' + @t + N') y;';
    EXEC sp_executesql @sql, N'@a bigint OUTPUT, @r bigint OUTPUT', @a OUTPUT, @r OUTPUT;
    IF @a > 0 OR @r > 0 OR @p <> @c INSERT INTO #d VALUES (@t, @p, @c, @a, @r, NULL);
  END TRY
  BEGIN CATCH
    INSERT INTO #d VALUES (@t, @p, @c, NULL, NULL, LEFT(ERROR_MESSAGE(), 140));
  END CATCH
  FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;

PRINT '===== 本次同步实际改动(现在 - 施工前) =====';
SELECT tbl AS 表, pre AS 施工前行数, now_rows AS 现在行数,
       now_rows - pre AS 净增行, added AS [新增或变更行], removed AS [删除或被改行], note AS 备注
FROM #d ORDER BY added DESC, removed DESC;
PRINT '===== 汇总 =====';
SELECT COUNT(*) AS 被改动表数, SUM(ISNULL(added,0)) AS [新增或变更行合计], SUM(ISNULL(removed,0)) AS [删除或被覆盖行合计] FROM #d;
PRINT '===== 全库总行数对比 =====';
SELECT (SELECT SUM(p.rows) FROM HSDZ_MES.sys.partitions p JOIN HSDZ_MES.sys.tables t ON t.object_id=p.object_id WHERE p.index_id IN (0,1) AND t.is_ms_shipped=0) AS 现在,
       (SELECT SUM(p.rows) FROM HSDZ_MES_PRESYNC1017.sys.partitions p JOIN HSDZ_MES_PRESYNC1017.sys.tables t ON t.object_id=p.object_id WHERE p.index_id IN (0,1) AND t.is_ms_shipped=0) AS 施工前;



