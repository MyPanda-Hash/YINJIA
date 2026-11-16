DECLARE @db sysname = DB_NAME();
DECLARE @path nvarchar(400) = @db + N'-pre-remote-migrations-20261115.bak';
BEGIN TRY
  BACKUP DATABASE @db TO DISK = @path WITH FORMAT, INIT, COMPRESSION, NAME = N'pre remote migrations 2026-11-15';
  PRINT N'[BACKUP OK] ' + @path;
END TRY
BEGIN CATCH
  PRINT N'[BACKUP FAIL] ' + ERROR_MESSAGE();
END CATCH
