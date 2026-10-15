SET NOCOUNT ON;
/* HSDZ_MES_SRV1015 到底是从哪个 .bak 还原的(判定"服务器现状"证据的有效性) */
SELECT TOP 6 rh.destination_database_name AS 目标库, bs.database_name AS 源库,
       bs.backup_start_date AS 备份时间, bmf.physical_device_name AS 备份文件, rh.restore_date AS 还原时间
FROM msdb.dbo.restorehistory rh
JOIN msdb.dbo.backupset bs ON bs.backup_set_id = rh.backup_set_id
LEFT JOIN msdb.dbo.backupmediafamily bmf ON bmf.media_set_id = bs.media_set_id
WHERE rh.destination_database_name IN (N'HSDZ_MES_SRV1015', N'HSDZ_MES_YJ2')
ORDER BY rh.restore_date DESC;
