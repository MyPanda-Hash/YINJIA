SET NOCOUNT ON;
/* ================= scjl 表:四库行数对照 ================= */
SELECT (SELECT COUNT(*) FROM [HSDZ_MES].dbo.scjl)         AS [正式库_当前],
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].dbo.scjl) AS [SRV1015_本bak还原],
       (SELECT COUNT(*) FROM [HSDZ_MES_YJ2].dbo.scjl)     AS [YJ2],
       (SELECT COUNT(*) FROM [HSDZ_MES_TEST].dbo.scjl)    AS [测试库];

/* ================= 列清单差异 ================= */
SELECT c.name AS [正式库有_快照没有]
FROM [HSDZ_MES].sys.columns c JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id WHERE t.name = 'scjl'
EXCEPT
SELECT c.name
FROM [HSDZ_MES_SRV1015].sys.columns c JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = c.object_id WHERE t.name = 'scjl';

SELECT c.name AS [快照有_正式库没有]
FROM [HSDZ_MES_SRV1015].sys.columns c JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = c.object_id WHERE t.name = 'scjl'
EXCEPT
SELECT c.name
FROM [HSDZ_MES].sys.columns c JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id WHERE t.name = 'scjl';

SELECT (SELECT COUNT(*) FROM [HSDZ_MES].sys.columns c JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id WHERE t.name = 'scjl') AS 正式列数,
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].sys.columns c JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = c.object_id WHERE t.name = 'scjl') AS 快照列数;

/* ================= 内容校验和 ================= */
SELECT (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES].dbo.scjl)        AS [正式库校验和],
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.scjl) AS [快照库校验和],
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_YJ2].dbo.scjl)     AS [YJ2校验和];

/* ================= 备份历史(看这份 .bak 的来源库与时间) ================= */
SELECT TOP 15 bs.database_name, bs.backup_start_date, bs.backup_finish_date, bs.type,
       bs.backup_size, bf.physical_device_name
FROM msdb.dbo.backupset bs
JOIN msdb.dbo.backupmediafamily bf ON bf.media_set_id = bs.media_set_id
ORDER BY bs.backup_finish_date DESC;
