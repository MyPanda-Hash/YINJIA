SET NOCOUNT ON;
SELECT name, CONVERT(varchar(19), create_date, 120) AS 创建, state_desc AS 状态,
       CONVERT(varchar(19), (SELECT MAX(backup_finish_date) FROM msdb.dbo.backupset b WHERE b.database_name = d.name), 120) AS 最近备份
  FROM sys.databases d ORDER BY create_date DESC;
