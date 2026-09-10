/* ============================================================
   restore-from-backup.sql — 用部署包里的 .bak 全量还原 HSDZ_MES
   ------------------------------------------------------------
   🔴 只在「服务器数据可以丢」时使用(测试机/重建环境)。
       服务器上有真实业务数据 → 请走增量路线(只补迁移脚本),不要跑本脚本。
   🔴 执行前:① 先停掉 MES 服务(否则连接占用会失败)② 确认服务器现有数据已另存备份。
   🔴 需要 sa 或 sysadmin 权限(yinjia 应用账号无 BACKUP/RESTORE 权限)。

   用法:
     1. 改下面 @bak 这一行为 .bak 的实际路径;
     2. sqlcmd -S localhost -E -b -f 65001 -i restore-from-backup.sql
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @bak nvarchar(4000) = N'D:\bak\HSDZ_MES_20260910.bak';   -- ← 改成实际路径
DECLARE @dp  nvarchar(4000) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(4000));
IF @dp IS NULL OR @dp = N'' SET @dp = N'C:\Program Files\Microsoft SQL Server\MSSQL15.MSSQLSERVER\MSSQL\DATA\';
IF RIGHT(@dp, 1) <> N'\' SET @dp = @dp + N'\';

IF NOT EXISTS (SELECT 1 FROM sys.master_files WHERE database_id = DB_ID('HSDZ_MES'))
BEGIN
    PRINT N'目标库 HSDZ_MES 不存在,将新建。';
END

DECLARE @sql nvarchar(max) =
    N'RESTORE DATABASE HSDZ_MES FROM DISK = N''' + @bak + N''' WITH '
  + N'MOVE ''ASPSMT''     TO N''' + @dp + N'HSDZ_MES.mdf'', '
  + N'MOVE ''ASPSMT_log'' TO N''' + @dp + N'HSDZ_MES_log.ldf'', '
  + N'RECOVERY, REPLACE';

PRINT N'--- 数据文件目录: ' + @dp;
PRINT @sql;
EXEC sp_executesql @sql;

ALTER DATABASE HSDZ_MES SET MULTI_USER;
PRINT N'restore-from-backup 完成:库已还原为备份快照,再跑 tools\check-migrations.sql 应「全部到位」。';
