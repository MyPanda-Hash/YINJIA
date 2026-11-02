SELECT TOP 25 目标库 = rh.destination_database_name, 还原时间 = rh.restore_date, 备份源库 = bs.database_name,
       备份时间 = bs.backup_finish_date, 类型 = rh.restore_type, 操作人 = rh.user_name
FROM msdb.dbo.restorehistory rh
JOIN msdb.dbo.backupset bs ON bs.backup_set_id = rh.backup_set_id
ORDER BY rh.restore_date DESC;
