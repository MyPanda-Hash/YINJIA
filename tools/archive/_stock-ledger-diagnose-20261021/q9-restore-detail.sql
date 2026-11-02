SELECT TOP 15 目标库 = rh.destination_database_name, 还原时间 = rh.restore_date,
       备份集ID = bs.backup_set_id, 备份源库 = bs.database_name, 备份完成time = bs.backup_finish_date,
       备份大小 = bs.backup_size, 介质 = bmf.physical_device_name, replace = rh.[replace], 恢复完成 = rh.recovery
FROM msdb.dbo.restorehistory rh
JOIN msdb.dbo.backupset bs ON bs.backup_set_id = rh.backup_set_id
LEFT JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
WHERE rh.restore_date >= '2026-10-18'
ORDER BY rh.restore_date DESC;
