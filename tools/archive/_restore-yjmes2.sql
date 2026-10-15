-- 一次性:把 db\yjmes2.bak 还原为临时库 HSDZ_MES_YJ2(供结构对比)
-- 文件已拷进容器数据目录 = 宿主机 D:\sql\data
SET NOCOUNT ON;
IF DB_ID(N'HSDZ_MES_YJ2') IS NOT NULL
BEGIN
    ALTER DATABASE [HSDZ_MES_YJ2] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [HSDZ_MES_YJ2];
END
GO
RESTORE DATABASE [HSDZ_MES_YJ2] FROM DISK = N'/var/opt/mssql/data/yjmes2.bak'
WITH RECOVERY,
     MOVE N'ASPSMT'     TO N'/var/opt/mssql/data/HSDZ_MES_YJ2.mdf',
     MOVE N'ASPSMT_log' TO N'/var/opt/mssql/data/HSDZ_MES_YJ2_log.ldf';
GO
SELECT name, state_desc, compatibility_level, collation_name, create_date, recovery_model_desc
FROM sys.databases WHERE name = N'HSDZ_MES_YJ2';
GO
USE [HSDZ_MES_YJ2];
IF USER_ID('yinjia') IS NULL CREATE USER [yinjia] FOR LOGIN [yinjia];
ELSE ALTER USER [yinjia] WITH LOGIN = [yinjia];
IF IS_ROLEMEMBER('db_datareader', 'yinjia') = 0 ALTER ROLE db_datareader ADD MEMBER [yinjia];
GO
