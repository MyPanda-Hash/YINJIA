SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#d') IS NOT NULL DROP TABLE #d;
CREATE TABLE #d (tbl sysname, srv_rows bigint, loc_rows bigint, srv_only bigint, loc_only bigint, note nvarchar(200));

DECLARE @t sysname, @sql nvarchar(max), @s bigint, @l bigint, @so bigint, @lo bigint;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT s.name + '.' + t.name FROM HSDZ_MES.sys.tables t
  JOIN HSDZ_MES.sys.schemas s ON s.schema_id = t.schema_id
  WHERE t.is_ms_shipped = 0
  ORDER BY t.name;
OPEN cur; FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @s=0; SET @l=0; SET @so=NULL; SET @lo=NULL;
  BEGIN TRY
    SET @sql = N'SELECT @s = COUNT_BIG(*) FROM HSDZ_MES_SRV1017.' + @t + N';
                SELECT @l = COUNT_BIG(*) FROM HSDZ_MES.' + @t + N';';
    EXEC sp_executesql @sql, N'@s bigint OUTPUT, @l bigint OUTPUT', @s OUTPUT, @l OUTPUT;

    SET @sql = N'SELECT @so = COUNT_BIG(*) FROM (SELECT * FROM HSDZ_MES_SRV1017.' + @t
             + N' EXCEPT SELECT * FROM HSDZ_MES.' + @t + N') x;
                SELECT @lo = COUNT_BIG(*) FROM (SELECT * FROM HSDZ_MES.' + @t
             + N' EXCEPT SELECT * FROM HSDZ_MES_SRV1017.' + @t + N') y;';
    EXEC sp_executesql @sql, N'@so bigint OUTPUT, @lo bigint OUTPUT', @so OUTPUT, @lo OUTPUT;
    INSERT INTO #d VALUES (@t, @s, @l, @so, @lo, NULL);
  END TRY
  BEGIN CATCH
    INSERT INTO #d VALUES (@t, @s, @l, NULL, NULL, LEFT(ERROR_MESSAGE(), 150));
  END CATCH
  FETCH NEXT FROM cur INTO @t;
END
CLOSE cur; DEALLOCATE cur;

PRINT '===== 1. 行数/内容有差异的表 (srv_only=服务器有本地无, loc_only=本地有服务器无) =====';
SELECT tbl AS 表, srv_rows AS 服务器行数, loc_rows AS 本地行数, srv_only AS 服务器独有行, loc_only AS 本地独有行, note AS 备注
FROM #d
WHERE note IS NOT NULL OR ISNULL(srv_only,0) <> 0 OR ISNULL(loc_only,0) <> 0 OR srv_rows <> loc_rows
ORDER BY tbl;

PRINT '===== 2. 完全一致的表数量 =====';
SELECT COUNT(*) AS 一致表数 FROM #d WHERE ISNULL(srv_only,0)=0 AND ISNULL(loc_only,0)=0 AND srv_rows=loc_rows;
PRINT '===== 3. 总计 =====';
SELECT COUNT(*) AS 总表数, SUM(srv_rows) AS 服务器总行, SUM(loc_rows) AS 本地总行 FROM #d;
