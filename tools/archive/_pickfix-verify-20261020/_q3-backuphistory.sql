SET NOCOUNT ON;
PRINT '--- 本机最近 10 次 HSDZ_MES 备份记录(msdb)---';
SELECT TOP 10
       bs.database_name AS 库,
       bs.type AS 类型,
       bs.backup_start_date AS 开始,
       bs.backup_finish_date AS 结束,
       bmf.physical_device_name AS 文件,
       bs.backup_size AS 大小字节
  FROM msdb.dbo.backupset bs
  JOIN msdb.dbo.backupmediafamily bmf
    ON bmf.media_set_id = bs.media_set_id
 WHERE bs.database_name LIKE N'HSDZ_MES%'
 ORDER BY bs.backup_start_date DESC;
