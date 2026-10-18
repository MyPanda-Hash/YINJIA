SET NOCOUNT ON;
/* 内容级校验:逐表比对「当前账套」与「快照库」的整体校验和 + 行数
   CHECKSUM_AGG/BINARY_CHECKSUM 与顺序无关(XOR 聚合),两表内容相同则值相同。 */
SELECT v.t AS 表名,
       (SELECT SUM(p.rows) FROM sys.partitions p JOIN sys.objects o ON o.object_id = p.object_id
         WHERE o.name = v.t AND p.index_id IN (0,1)) AS 当前行数,
       (SELECT SUM(p.rows) FROM [HSDZ_MES_SRV1015].sys.partitions p
         JOIN [HSDZ_MES_SRV1015].sys.objects o ON o.object_id = p.object_id
         WHERE o.name = v.t AND p.index_id IN (0,1)) AS 快照行数
FROM (VALUES (N'dm_langue'),(N'gscs'),(N'permission'),(N's_commdata'),(N's_sys'),(N's_xtcs')) AS v(t);

SELECT N'dm_langue' AS 表名,
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.dm_langue) AS 当前校验和,
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.dm_langue) AS 快照校验和
UNION ALL SELECT N'gscs',
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.gscs),
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.gscs)
UNION ALL SELECT N'permission',
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.permission),
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.permission)
UNION ALL SELECT N's_commdata',
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.s_commdata),
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.s_commdata)
UNION ALL SELECT N's_sys',
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.s_sys),
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.s_sys)
UNION ALL SELECT N's_xtcs',
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.s_xtcs),
       (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM [HSDZ_MES_SRV1015].dbo.s_xtcs);

/* 结构级:列数与列名清单是否一致 */
SELECT v.t AS 表名,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + v.t)) AS 当前列数,
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].sys.columns c
         JOIN [HSDZ_MES_SRV1015].sys.tables tb ON tb.object_id = c.object_id WHERE tb.name = v.t) AS 快照列数,
       (SELECT COUNT(*) FROM (
            SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + v.t)
            EXCEPT
            SELECT c.name FROM [HSDZ_MES_SRV1015].sys.columns c
              JOIN [HSDZ_MES_SRV1015].sys.tables tb ON tb.object_id = c.object_id WHERE tb.name = v.t) x) AS 列名差异数
FROM (VALUES (N'dm_langue'),(N'gscs'),(N'permission'),(N's_commdata'),(N's_sys'),(N's_xtcs')) AS v(t);

/* 表级中文注明是否都在 */
SELECT v.t AS 表名,
       CASE WHEN EXISTS (SELECT 1 FROM sys.extended_properties ep JOIN sys.tables tb ON tb.object_id = ep.major_id
                          WHERE tb.name = v.t AND ep.name = N'MS_Description' AND ep.minor_id = 0)
            THEN N'有' ELSE N'无' END AS 中文注明
FROM (VALUES (N'dm_langue'),(N'gscs'),(N'permission'),(N's_commdata'),(N's_sys'),(N's_xtcs')) AS v(t);
