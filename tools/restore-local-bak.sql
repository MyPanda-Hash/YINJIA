/* ============================================================
   restore-local-bak.sql — 用指定 .bak 全量覆盖 HSDZ_MES(REPLACE)
   ------------------------------------------------------------
   由 push-db.bat 调用;备份路径通过 sqlcmd 变量 BAK 传入:
     sqlcmd -S localhost -E -b -v BAK="C:\yinjia\backup\HSDZ_MES_local.bak" -i restore-local-bak.sql

   本仓库的库快照逻辑文件名固定为 ASPSMT / ASPSMT_log。
   数据文件落盘目录自动取 SERVERPROPERTY('InstanceDefaultDataPath'),不用手写。
   🔴 会整体覆盖目标库;调用方必须先备份。
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @bak nvarchar(4000) = N'$(BAK)';
IF @bak LIKE N'$%' OR @bak = N''
BEGIN
    RAISERROR(N'[FATAL] 未通过 -v BAK=... 传入备份路径', 16, 1);
    SET NOEXEC ON;
END

DECLARE @dp nvarchar(4000) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000));
IF @dp IS NULL OR @dp = N'' SET @dp = N'C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\';
IF RIGHT(@dp, 1) <> N'\' SET @dp = @dp + N'\';

PRINT N'--- source bak : ' + @bak;
PRINT N'--- data dir   : ' + @dp;

IF DB_ID('HSDZ_MES') IS NOT NULL
    ALTER DATABASE HSDZ_MES SET SINGLE_USER WITH ROLLBACK IMMEDIATE;

DECLARE @sql nvarchar(max) =
    N'RESTORE DATABASE HSDZ_MES FROM DISK = N''' + @bak + N''' WITH '
  + N'MOVE ''ASPSMT''     TO N''' + @dp + N'HSDZ_MES.mdf'', '
  + N'MOVE ''ASPSMT_log'' TO N''' + @dp + N'HSDZ_MES_log.ldf'', '
  + N'RECOVERY, REPLACE';

PRINT @sql;
EXEC sp_executesql @sql;

ALTER DATABASE HSDZ_MES SET MULTI_USER;
PRINT N'RESTORE-DONE';
GO
