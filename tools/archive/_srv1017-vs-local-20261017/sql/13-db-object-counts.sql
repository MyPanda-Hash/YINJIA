DECLARE @dbs TABLE(db sysname);
INSERT INTO @dbs VALUES('HSDZ_MES'),('HSDZ_MES_SRV1017'),('HSDZ_MES_SRV1015');
DECLARE @db sysname, @sql nvarchar(max);
DECLARE cur CURSOR FOR SELECT db FROM @dbs; OPEN cur; FETCH NEXT FROM cur INTO @db;
WHILE @@FETCH_STATUS=0 BEGIN
  SET @sql = N'SELECT ''' + @db + N''' db,
    (SELECT COUNT(*) FROM [' + @db + N'].sys.tables) tbls,
    (SELECT COUNT(*) FROM [' + @db + N'].sys.columns) cols,
    (SELECT COUNT(*) FROM [' + @db + N'].sys.views) vws,
    (SELECT COUNT(*) FROM [' + @db + N'].dbo.yj_panel) panels,
    (SELECT COUNT(*) FROM [' + @db + N'].dbo.yj_field) fields,
    (SELECT COUNT(*) FROM [' + @db + N'].dbo.yj_translation) trans,
    (SELECT COUNT(*) FROM [' + @db + N'].dbo.yj_schema_log) logs';
  EXEC(@sql);
  FETCH NEXT FROM cur INTO @db;
END
CLOSE cur; DEALLOCATE cur;
