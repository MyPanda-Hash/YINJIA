/* 逐视图编译体检(只读):动态 SELECT TOP 0,捕获 207 列名无效等错误,打印视图名 + 错误信息 */
SET NOCOUNT ON;
DECLARE @v sysname, @sql nvarchar(max), @msg nvarchar(500), @bad int = 0;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT name FROM sys.views WHERE is_ms_shipped = 0 ORDER BY name;
OPEN c;
FETCH NEXT FROM c INTO @v;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'SELECT TOP 0 * FROM ' + QUOTENAME(@v);
  BEGIN TRY
    EXEC sp_executesql @sql;
  END TRY
  BEGIN CATCH
    SET @bad = @bad + 1;
    SET @msg = LEFT(ERROR_MESSAGE(), 300);
    PRINT N'[BAD] ' + @v + N' :: ' + @msg;
  END CATCH
  FETCH NEXT FROM c INTO @v;
END
CLOSE c; DEALLOCATE c;
PRINT N'[TOTAL-BAD-VIEWS] ' + CAST(@bad AS nvarchar(10));
