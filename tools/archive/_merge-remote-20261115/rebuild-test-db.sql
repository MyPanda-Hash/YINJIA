/* 重建测试库 HSDZ_MES_TEST = 正式库 HSDZ_MES 的当前快照(含本日已执行的全部远端迁移)。
 * 背景:测试库是旧快照,视图/基表结构已陈旧(14 个面板 500:视图缺列/缺对象),
 *       按 repo 既有处置口径「测试库结构陈旧 ⇒ 直接重建」(make-test-db.ps1 同思路)。
 * 用 **sa**(sysadmin)执行;yinjia 无此权限。
 * ⚠ 会覆盖测试库全部数据(测试库定位=演示/试用,数据可弃)。
 */
SET NOCOUNT ON;
DECLARE @src sysname = N'HSDZ_MES', @dst sysname = N'HSDZ_MES_TEST';
DECLARE @bak nvarchar(400) = N'/var/opt/mssql/data/HSDZ_MES-for-test-20261115.bak';

/* ① 备份正式库(当前含全部迁移) */
BACKUP DATABASE [HSDZ_MES] TO DISK = @bak WITH INIT, COMPRESSION, NAME = N'for test rebuild 2026-11-15', STATS = 25;
PRINT N'[BACKUP OK] ' + @bak;

/* ② 取备份里的逻辑文件名 */
CREATE TABLE #fl (LogicalName sysname, PhysicalName nvarchar(400), Type char(1), FileGroupName nvarchar(128),
                  Size numeric(20,0), MaxSize numeric(20,0), FileId bigint, CreateLSN numeric(25,0),
                  DropLSN numeric(25,0), UniqueId uniqueidentifier, ReadOnlyLSN numeric(25,0),
                  ReadWriteLSN numeric(25,0), BackupSizeInBytes bigint, SourceBlockSize int,
                  FileGroupId int, LogGroupGUID uniqueidentifier, DifferentialBaseLSN numeric(25,0),
                  DifferentialBaseGUID uniqueidentifier, IsReadOnly bit, IsPresent bit,
                  TDEThumbprint varbinary(32), SnapshotURL nvarchar(400));
INSERT INTO #fl EXEC (N'RESTORE FILELISTONLY FROM DISK = N''' + @bak + N'''');

DECLARE @dataLogical sysname = (SELECT TOP 1 LogicalName FROM #fl WHERE Type = 'D');
DECLARE @logLogical  sysname = (SELECT TOP 1 LogicalName FROM #fl WHERE Type = 'L');
PRINT N'[filelist] data=' + ISNULL(@dataLogical, N'?') + N' log=' + ISNULL(@logLogical, N'?');
IF @dataLogical IS NULL OR @logLogical IS NULL
BEGIN
  RAISERROR(N'[FAIL] 备份文件缺少数据/日志逻辑名,已中止', 16, 1);
  RETURN;
END

/* ③ 踢掉测试库现有连接,整库替换(动态 SQL:RESTORE 的 MOVE 子句不能直接拼变量) */
IF DB_ID(N'HSDZ_MES_TEST') IS NOT NULL
    ALTER DATABASE [HSDZ_MES_TEST] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;

DECLARE @sql nvarchar(max) =
    N'RESTORE DATABASE [HSDZ_MES_TEST] FROM DISK = N''' + @bak + N''' WITH RECOVERY, REPLACE, STATS = 25, '
  + N'MOVE N''' + @dataLogical + N''' TO N''/var/opt/mssql/data/HSDZ_MES_TEST.mdf'', '
  + N'MOVE N''' + @logLogical  + N''' TO N''/var/opt/mssql/data/HSDZ_MES_TEST_log.ldf''';
EXEC sp_executesql @sql;
ALTER DATABASE [HSDZ_MES_TEST] SET MULTI_USER;
DROP TABLE #fl;
PRINT N'[RESTORE OK] HSDZ_MES_TEST <= HSDZ_MES (2026-11-15)';
