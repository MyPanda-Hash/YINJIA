SELECT 'LOCAL_HSDZ_MES_FILES' AS info, name, physical_name FROM sys.master_files WHERE DB_NAME(database_id) = 'HSDZ_MES';
GO
RESTORE FILELISTONLY FROM DISK = N'/var/opt/mssql/backup/HSDZ_MES_server_20260928.bak';
GO
