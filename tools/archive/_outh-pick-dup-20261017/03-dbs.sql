SET NOCOUNT ON;
DECLARE @dbs TABLE (n sysname);
INSERT INTO @dbs VALUES (N'HSDZ_MES'),(N'HSDZ_MES_TEST'),(N'HSDZ_MES_SRV1017'),(N'HSDZ_MES_SRV1015'),(N'HSDZ_MES_YJ2'),(N'HSDZ_MES_PRESYNC1017'),(N'HSDZ_MES_0828');
DECLARE @n sysname, @sql nvarchar(max), @c int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT n FROM @dbs;
OPEN cur; FETCH NEXT FROM cur INTO @n;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF DB_ID(@n) IS NOT NULL
  BEGIN
    SET @sql = N'SELECT N''' + @n + N''' AS 库, 单据类型, COUNT(*) AS 行数 FROM [' + @n + N'].dbo.outh GROUP BY 单据类型;';
    EXEC sp_executesql @sql;
    SET @sql = N'SELECT N''' + @n + N''' AS 库, COUNT(*) AS LL行数 FROM [' + @n + N'].dbo.outh WHERE 单据编号 LIKE ''LL%'';';
    EXEC sp_executesql @sql;
    SET @sql = N'SELECT N''' + @n + N''' AS 库, COUNT(*) AS 无工单号行 FROM [' + @n + N'].dbo.outh WHERE src=6 AND (工单号 IS NULL OR RTRIM(工单号)='''');';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cur INTO @n;
END
CLOSE cur; DEALLOCATE cur;
