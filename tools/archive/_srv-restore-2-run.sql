USE master;
GO
IF DB_ID('HSDZ_MES_TEST') IS NOT NULL ALTER DATABASE [HSDZ_MES_TEST] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO
RESTORE DATABASE [HSDZ_MES_TEST] FROM DISK = N'/var/opt/mssql/backup/HSDZ_MES_server_20260928.bak'
  WITH RECOVERY, REPLACE,
  MOVE 'ASPSMT'     TO '/var/opt/mssql/data/HSDZ_MES_TEST.mdf',
  MOVE 'ASPSMT_log' TO '/var/opt/mssql/data/HSDZ_MES_TEST_log.ldf';
GO
USE [HSDZ_MES_TEST];
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'yinjia') CREATE USER [yinjia] FOR LOGIN [yinjia];
ALTER USER [yinjia] WITH LOGIN = [yinjia];
ALTER ROLE db_owner ADD MEMBER [yinjia];
GO
USE [HSDZ_MES_TEST];
SELECT 'TABLES'          AS K, CAST(COUNT(*) AS nvarchar(20)) AS V FROM sys.tables
UNION ALL SELECT 'SCHEMA_LOG',    CAST(COUNT(*) AS nvarchar(20)) FROM yj_schema_log
UNION ALL SELECT 'PANELS',        CAST(COUNT(*) AS nvarchar(20)) FROM yj_panel
UNION ALL SELECT 'FIELDS',        CAST(COUNT(*) AS nvarchar(20)) FROM yj_field
UNION ALL SELECT 'USERS',         CAST(COUNT(*) AS nvarchar(20)) FROM yj_user
UNION ALL SELECT 'PLANG_ROWS',    CAST(COUNT(*) AS nvarchar(20)) FROM plang
UNION ALL SELECT 'PLANG_MAXDATE', CAST(CAST(MAX(pl_date) AS date) AS nvarchar(10)) FROM plang
UNION ALL SELECT 'PLANGPC_ROWS',  CAST(COUNT(*) AS nvarchar(20)) FROM plang_pc
UNION ALL SELECT 'MANU_ROWS',     CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order
UNION ALL SELECT 'MANU_LEGACY_BAD', CAST(COUNT(*) AS nvarchar(20)) FROM bd_manu_order
  WHERE [测试程序2] IS NOT NULL OR [生产订单客户] IS NOT NULL OR [外部单据号] IS NOT NULL
     OR [对方仓库] IS NOT NULL OR [启用领料申请] IS NOT NULL OR [启用派工] IS NOT NULL
     OR [自动转移] IS NOT NULL OR [产品自动添加到材料] IS NOT NULL
UNION ALL SELECT 'WO_REPORT_ROWS', CAST(COUNT(*) AS nvarchar(20)) FROM wo_report
UNION ALL SELECT 'SCJL_ROWS',     CAST(COUNT(*) AS nvarchar(20)) FROM scjl
UNION ALL SELECT 'ATTACH_ROWS',   CAST(COUNT(*) AS nvarchar(20)) FROM yj_attachment
UNION ALL SELECT 'SO_LINES',      CAST(COUNT(*) AS nvarchar(20)) FROM bl_so_order
UNION ALL SELECT 'SL_RECV_ROWS',  CAST(COUNT(*) AS nvarchar(20)) FROM sl_recv;
GO
