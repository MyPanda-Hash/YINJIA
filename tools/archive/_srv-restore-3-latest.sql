USE master;
GO
IF DB_ID('HSDZ_MES_TEST') IS NOT NULL ALTER DATABASE [HSDZ_MES_TEST] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO
RESTORE DATABASE [HSDZ_MES_TEST] FROM DISK = N'/var/opt/mssql/backup/HSDZ_MES_server_latest.bak'
  WITH RECOVERY, REPLACE,
  MOVE 'ASPSMT' TO '/var/opt/mssql/data/HSDZ_MES_TEST.mdf',
  MOVE 'ASPSMT_log' TO '/var/opt/mssql/data/HSDZ_MES_TEST_log.ldf';
GO
USE [HSDZ_MES_TEST];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia];
ALTER USER [yinjia] WITH LOGIN = [yinjia];
ALTER ROLE db_owner ADD MEMBER [yinjia];
GO
SET NOCOUNT ON;
SELECT 'SCHEMA_LOG' K, CAST(COUNT(*) AS nvarchar(20)) V FROM yj_schema_log
UNION ALL SELECT 'PANELS', CAST(COUNT(*) AS nvarchar(20)) FROM yj_panel
UNION ALL SELECT 'FIELDS', CAST(COUNT(*) AS nvarchar(20)) FROM yj_field
UNION ALL SELECT 'PU_NULL行号', CAST(COUNT(*) AS nvarchar(20)) FROM bl_pu_order WHERE ISNULL(行号,'')=''
UNION ALL SELECT 'QC_INSP', CAST(COUNT(*) AS nvarchar(20)) FROM qc_insp
UNION ALL SELECT 'QC_RECV供应商SEQ', CAST(MAX(seq) AS nvarchar(20)) FROM yj_field WHERE panel_code='QC_RECV' AND col_name=N'供应商';
GO
