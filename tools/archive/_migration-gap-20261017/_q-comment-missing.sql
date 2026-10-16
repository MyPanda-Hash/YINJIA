SET NOCOUNT ON;
DECLARE @t TABLE (n sysname);
INSERT INTO @t (n) VALUES (N'dm_langue'), (N'gscs'), (N'permission'), (N's_commdata'),
                          (N's_sys'), (N's_xtcs'), (N'inh'), (N'outh'), (N'scjl');

/* ① 缺注明的列 + 全库同名列「原有描述」作为参照口径(优先取服务器快照,再取本地) */
;WITH Missing AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS len,
           c.column_id AS cid
    FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN @t f ON f.n = t.name
    WHERE NOT EXISTS (SELECT 1 FROM [HSDZ_MES].sys.extended_properties ep
                       WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description')
)
SELECT m.tbl AS 表, m.col AS 列, m.typ AS 类型, m.len AS 长,
       ISNULL((
         SELECT TOP 1 CAST(ep.value AS nvarchar(200))
         FROM [HSDZ_MES_SRV1015].sys.columns c2
         JOIN [HSDZ_MES_SRV1015].sys.extended_properties ep ON ep.major_id = c2.object_id AND ep.minor_id = c2.column_id AND ep.name = N'MS_Description'
         WHERE c2.name = m.col AND ISNULL(CAST(ep.value AS nvarchar(200)), N'') <> N''
         GROUP BY CAST(ep.value AS nvarchar(200))
         ORDER BY COUNT(*) DESC), N'') AS 快照同名列原有描述,
       ISNULL((
         SELECT TOP 1 CAST(ep.value AS nvarchar(200))
         FROM [HSDZ_MES].sys.columns c3
         JOIN [HSDZ_MES].sys.extended_properties ep ON ep.major_id = c3.object_id AND ep.minor_id = c3.column_id AND ep.name = N'MS_Description'
         WHERE c3.name = m.col AND ISNULL(CAST(ep.value AS nvarchar(200)), N'') <> N''
         GROUP BY CAST(ep.value AS nvarchar(200))
         ORDER BY COUNT(*) DESC), N'') AS 本地同名列原有描述
FROM Missing m
ORDER BY m.tbl, m.cid;

/* ② 每表缺注明数 */
;WITH Missing AS (
    SELECT t.name AS tbl
    FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
    JOIN @t f ON f.n = t.name
    WHERE NOT EXISTS (SELECT 1 FROM [HSDZ_MES].sys.extended_properties ep
                       WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description')
)
SELECT tbl AS 表, COUNT(*) AS 缺注明列数 FROM Missing GROUP BY tbl ORDER BY 表;
