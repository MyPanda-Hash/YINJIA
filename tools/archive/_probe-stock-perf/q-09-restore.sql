SET NOCOUNT ON;
SELECT name, create_date, state_desc, compatibility_level, collation_name FROM sys.databases WHERE name=DB_NAME();
GO
SELECT TOP 5 r.database_name, r.type, r.backup_finish_date
  FROM msdb.dbo.restorehistory r ORDER BY r.restore_date DESC;
GO
