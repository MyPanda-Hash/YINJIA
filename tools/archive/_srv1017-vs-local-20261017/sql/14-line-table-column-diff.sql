SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#cd') IS NOT NULL DROP TABLE #cd;
CREATE TABLE #cd (tbl sysname, col sysname, diff_cnt bigint, err nvarchar(200));

DECLARE @tbl sysname, @pk sysname, @sql nvarchar(max), @col sysname, @cnt bigint, @err nvarchar(400);

DECLARE curT CURSOR LOCAL FAST_FORWARD FOR SELECT 'bl_so_order' UNION ALL SELECT 'bl_pu_order';
OPEN curT; FETCH NEXT FROM curT INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
  DECLARE curC CURSOR LOCAL FAST_FORWARD FOR
    SELECT c.name FROM HSDZ_MES.sys.columns c JOIN HSDZ_MES.sys.tables t ON t.object_id=c.object_id
    JOIN HSDZ_MES.sys.types ty ON ty.user_type_id=c.user_type_id
    WHERE t.name=@tbl AND c.name <> 'id' AND ty.name NOT IN ('text','ntext','image','xml')
    ORDER BY c.column_id;
  OPEN curC; FETCH NEXT FROM curC INTO @col;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @cnt = 0; SET @err = NULL;
    SET @sql = N'SELECT @c = COUNT_BIG(*) FROM HSDZ_MES.dbo.' + QUOTENAME(@tbl) + N' a
      JOIN HSDZ_MES_SRV1017.dbo.' + QUOTENAME(@tbl) + N' b ON b.id = a.id
      WHERE CASE WHEN (a.' + QUOTENAME(@col) + N' = b.' + QUOTENAME(@col) + N') THEN 0
                 WHEN (a.' + QUOTENAME(@col) + N' IS NULL AND b.' + QUOTENAME(@col) + N' IS NULL) THEN 0
                 ELSE 1 END = 1';
    BEGIN TRY
      EXEC sp_executesql @sql, N'@c bigint OUTPUT', @cnt OUTPUT;
      IF @cnt > 0 INSERT INTO #cd VALUES (@tbl, @col, @cnt, NULL);
    END TRY
    BEGIN CATCH
      SET @err = LEFT(ERROR_MESSAGE(), 190);
      INSERT INTO #cd VALUES (@tbl, @col, -1, @err);
    END CATCH
    FETCH NEXT FROM curC INTO @col;
  END
  CLOSE curC; DEALLOCATE curC;
  FETCH NEXT FROM curT INTO @tbl;
END
CLOSE curT; DEALLOCATE curT;

SELECT tbl AS 表, col AS 差异列, diff_cnt AS 差异行数, err AS 错误 FROM #cd ORDER BY tbl, diff_cnt DESC;
