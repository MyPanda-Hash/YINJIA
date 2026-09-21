-- ═══════════════════════════════════════════════════════════════
-- HSDZ_MES 全量恢复脚本（全量部署 2026-09-14 制备）
-- 使用方法：SSMS 连服务器 localhost（Windows 身份验证），整段执行
-- 前提：HSDZ_MES_golive_20260914-174615.bak 已复制到服务器 C:\yinjia\
-- ═══════════════════════════════════════════════════════════════
USE master;
GO
-- 如服务器已有旧库先强删
IF DB_ID(N'HSDZ_MES') IS NOT NULL
    EXEC(N'ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [HSDZ_MES];');
GO
-- 自动探测数据目录并恢复
DECLARE @data NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400));
DECLARE @sql NVARCHAR(MAX) = N'RESTORE DATABASE [HSDZ_MES] FROM DISK = N''C:\yinjia\HSDZ_MES_golive_20260914-174615.bak'' WITH RECOVERY, '
    + N'MOVE N''ASPSMT''     TO ''' + @data + N'HSDZ_MES.mdf'', '
    + N'MOVE N''ASPSMT_log'' TO ''' + @data + N'HSDZ_MES_log.ldf''';
PRINT N'使用数据目录: ' + @data;
EXEC(@sql);
GO
-- 建登录映射 + 授权
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'yinjia')
    CREATE LOGIN [yinjia] WITH PASSWORD = N'Yinjia@2026', CHECK_POLICY = OFF;
USE [HSDZ_MES];
ALTER USER [yinjia] WITH LOGIN = [yinjia];
EXEC sp_addrolemember N'db_datareader', N'yinjia';
EXEC sp_addrolemember N'db_datawriter', N'yinjia';
EXEC sp_addrolemember N'db_ddladmin',  N'yinjia';
GO
PRINT N'✅ 恢复完成。接下来把 app.jar 放到 C:\yinjia\update\ 后双击 update.bat';
