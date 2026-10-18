SET NOCOUNT ON;
-- 逐列差异统计:仅针对有单列主键的表,按主键 JOIN 后比较每个列
IF OBJECT_ID('tempdb..#cd') IS NOT NULL DROP TABLE #cd;
CREATE TABLE #cd (tbl sysname, col sysname, diff_cnt bigint, total bigint);

DECLARE @tbl sysname, @schema sysname, @pk sysname, @sql nvarchar(max), @col sysname;
DECLARE @cnt bigint, @tot bigint;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT s.name, t.name, c.name
  FROM HSDZ_MES.sys.tables t
  JOIN HSDZ_MES.sys.schemas s ON s.schema_id = t.schema_id
  JOIN HSDZ_MES.sys.indexes i ON i.object_id = t.object_id AND i.is_primary_key = 1
  JOIN HSDZ_MES.sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
  JOIN HSDZ_MES.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE t.is_ms_shipped = 0
    AND (SELECT COUNT(*) FROM HSDZ_MES.sys.index_columns ic2 WHERE ic2.object_id=i.object_id AND ic2.index_id=i.index_id) = 1
  ORDER BY t.name;
OPEN cur; FETCH NEXT FROM cur INTO @schema, @tbl, @pk;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'SELECT @tot = COUNT_BIG(*) FROM HSDZ_MES.' + QUOTENAME(@schema) + N'.' + QUOTENAME(@tbl);
  EXEC sp_executesql @sql, N'@tot bigint OUTPUT', @tot OUTPUT;

  DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
    SELECT c.name FROM HSDZ_MES.sys.columns c
    JOIN HSDZ_MES.sys.tables t ON t.object_id = c.object_id
    JOIN HSDZ_MES.sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = @schema AND t.name = @tbl AND c.name <> @pk
      AND c.system_type_id NOT IN (34,35,99,241,189,98)  -- image/text/ntext/xml/sql_variant/geography-ish
    ORDER BY c.column_id;
  OPEN cur2; FETCH NEXT FROM cur2 INTO @col;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    SET @cnt = 0;
    BEGIN TRY
      SET @sql = N'SELECT @cnt = COUNT_BIG(*) FROM HSDZ_MES.' + QUOTENAME(@schema) + N'.' + QUOTENAME(@tbl) + N' a
        JOIN HSDZ_MES_SRV1017.' + QUOTENAME(@schema) + N'.' + QUOTENAME(@tbl) + N' b ON b.' + QUOTENAME(@pk) + N' = a.' + QUOTENAME(@pk) + N'
        WHERE (a.' + QUOTENAME(@col) + N' <> b.' + QUOTENAME(@col) + N')
           OR (a.' + QUOTENAME(@col) + N' IS NULL AND b.' + QUOTENAME(@col) + N' IS NOT NULL)
           OR (a.' + QUOTENAME(@col) + N' IS NOT NULL AND b.' + QUOTENAME(@col) + N' IS NULL)';
      EXEC sp_executesql @sql, N'@cnt bigint OUTPUT', @cnt OUTPUT;
      IF @cnt > 0 INSERT INTO #cd VALUES (@tbl, @col, @cnt, @tot);
    END TRY
    BEGIN CATCH
      INSERT INTO #cd VALUES (@tbl, @col, -1, @tot);
    END CATCH
    FETCH NEXT FROM cur2 INTO @col;
  END
  CLOSE cur2; DEALLOCATE cur2;
  FETCH NEXT FROM cur INTO @schema, @tbl, @pk;
END
CLOSE cur; DEALLOCATE cur;

SELECT tbl AS 表, col AS 差异列, diff_cnt AS 差异行数, total AS 表总行数
FROM #cd ORDER BY tbl, diff_cnt DESC;
