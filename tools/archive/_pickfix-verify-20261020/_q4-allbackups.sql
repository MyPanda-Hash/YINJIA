SET NOCOUNT ON;
PRINT '--- 2026-10-19 12:00 之后所有库的备份记录 ---';
SELECT bs.database_name AS 库,
       CASE bs.type WHEN 'D' THEN '全量' WHEN 'I' THEN '差异' WHEN 'L' THEN '日志' ELSE bs.type END AS 类型,
       bs.backup_start_date AS 开始,
       bmf.physical_device_name AS 文件,
       bs.backup_size AS 字节
  FROM msdb.dbo.backupset bs
  JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
 WHERE bs.backup_start_date >= '2026-10-19 12:00:00'
 ORDER BY bs.backup_start_date DESC;

PRINT '--- 本实例数据库清单 ---';
SELECT name AS 库, state_desc, create_date FROM sys.databases ORDER BY database_id;
