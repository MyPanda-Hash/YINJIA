SET NOCOUNT ON;
PRINT 'RESTORE3-START';
USE master;
GO
IF DB_ID(N'HSDZ_MES') IS NOT NULL
BEGIN
    PRINT 'DROP-OLD-DB';
    EXEC(N'ALTER DATABASE [HSDZ_MES] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [HSDZ_MES];');
END
ELSE
    PRINT 'NO-OLD-DB';
GO
DECLARE @data NVARCHAR(400) = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS NVARCHAR(400));
DECLARE @sql NVARCHAR(MAX) = N'RESTORE DATABASE [HSDZ_MES] FROM DISK = N''C:\yinjia\HSDZ_MES.bak'' WITH RECOVERY, STATS=5, '
    + N'MOVE N''ASPSMT''     TO ''' + @data + N'HSDZ_MES.mdf'', '
    + N'MOVE N''ASPSMT_log'' TO ''' + @data + N'HSDZ_MES_log.ldf''';
PRINT 'DATADIR=' + @data;
EXEC(@sql);
PRINT 'RESTORE-RETURNED';
GO
IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'yinjia')
    CREATE LOGIN [yinjia] WITH PASSWORD = N'Yinjia@2026', CHECK_POLICY = OFF;
USE [HSDZ_MES];
ALTER USER [yinjia] WITH LOGIN = [yinjia];
EXEC sp_addrolemember N'db_datareader', N'yinjia';
EXEC sp_addrolemember N'db_datawriter', N'yinjia';
EXEC sp_addrolemember N'db_ddladmin',  N'yinjia';
EXEC sp_addrolemember N'db_owner',     N'yinjia';
GO
IF EXISTS (SELECT 1 FROM HSDZ_MES.dbo.yj_panel WHERE panel_code = N'SL_RECV')
    UPDATE HSDZ_MES.dbo.yj_user SET real_name = N'DB-NEW-OK' WHERE username = N'admin';
ELSE
    UPDATE HSDZ_MES.dbo.yj_user SET real_name = N'DB-STILL-OLD' WHERE username = N'admin';
GO
