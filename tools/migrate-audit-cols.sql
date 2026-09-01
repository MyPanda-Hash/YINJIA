-- 审计留痕列补齐:bd_ 与 bl_ 前缀的单据表统一补 asp_user1 / asp_time1 / asp_user2 / asp_time2 / asp_cancel(幂等)
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @t sysname, @cols nvarchar(max), @sql nvarchar(max);
DECLARE c CURSOR FOR SELECT name FROM sys.tables WHERE name LIKE 'bd[_]%' OR name LIKE 'bl[_]%';
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @cols = N'';
  IF COL_LENGTH(@t, 'asp_user1') IS NULL SET @cols = @cols + N', asp_user1 nvarchar(50) NULL';
  IF COL_LENGTH(@t, 'asp_time1') IS NULL SET @cols = @cols + N', asp_time1 datetime2 NULL';
  IF COL_LENGTH(@t, 'asp_user2') IS NULL SET @cols = @cols + N', asp_user2 nvarchar(50) NULL';
  IF COL_LENGTH(@t, 'asp_time2') IS NULL SET @cols = @cols + N', asp_time2 datetime2 NULL';
  IF COL_LENGTH(@t, 'asp_cancel') IS NULL SET @cols = @cols + N', asp_cancel char(1) NULL DEFAULT N''N''';
  IF LEN(@cols) > 0 BEGIN
    SET @sql = N'ALTER TABLE ' + @t + N' ADD ' + STUFF(@cols, 1, 2, N'');
    EXEC(@sql);
  END
  FETCH NEXT FROM c INTO @t;
END
CLOSE c;
DEALLOCATE c;
SELECT COUNT(*) AS tables_left_missing
FROM sys.tables t
WHERE (t.name LIKE 'bd[_]%' OR t.name LIKE 'bl[_]%')
  AND (COL_LENGTH(t.name, 'asp_user1') IS NULL OR COL_LENGTH(t.name, 'asp_time1') IS NULL
    OR COL_LENGTH(t.name, 'asp_user2') IS NULL OR COL_LENGTH(t.name, 'asp_time2') IS NULL
    OR COL_LENGTH(t.name, 'asp_cancel') IS NULL);
