SELECT TOP 6 database_name, backup_finish_date, physical_device_name,
       CAST(backup_size/1024/1024 AS int) AS mb
FROM msdb.dbo.backupset b
JOIN msdb.dbo.backupmediafamily f ON f.media_set_id = b.media_set_id
ORDER BY backup_finish_date DESC;
