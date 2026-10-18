SET NOCOUNT ON;
DECLARE @t TABLE (n sysname);
INSERT INTO @t (n) VALUES (N'dm_langue'), (N'gscs'), (N'permission'), (N's_commdata'),
                          (N's_sys'), (N's_xtcs'), (N'inh'), (N'outh'), (N'scjl');

/* ① 表级注明:本地 vs 快照 */
SELECT v.n AS 表,
       ISNULL((SELECT CAST(ep.value AS nvarchar(400)) FROM [HSDZ_MES].sys.tables t
                 JOIN [HSDZ_MES].sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = N'MS_Description'
                WHERE t.name = v.n), N'(无)') AS 本地表级注明,
       ISNULL((SELECT CAST(ep.value AS nvarchar(400)) FROM [HSDZ_MES_SRV1015].sys.tables t
                 JOIN [HSDZ_MES_SRV1015].sys.extended_properties ep ON ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name = N'MS_Description'
                WHERE t.name = v.n), N'(无)') AS 快照表级注明
FROM @t v ORDER BY v.n;

/* ② 列级注明覆盖数:本地 vs 快照 */
SELECT v.n AS 表,
       (SELECT COUNT(*) FROM [HSDZ_MES].sys.tables t
          JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
          JOIN [HSDZ_MES].sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description'
         WHERE t.name = v.n) AS 本地列注明,
       (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].sys.tables t
          JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id
          JOIN [HSDZ_MES_SRV1015].sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description'
         WHERE t.name = v.n) AS 快照列注明,
       (SELECT COUNT(*) FROM [HSDZ_MES].sys.columns c JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id WHERE t.name = v.n) AS 总列数
FROM @t v ORDER BY v.n;

/* ③ 逐列注明差异(缺 / 文案不同) */
;WITH L AS (
    SELECT t.name AS tbl, c.name AS col, CAST(ep.value AS nvarchar(400)) AS cmt
    FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
    LEFT JOIN [HSDZ_MES].sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description'
    JOIN @t f ON f.n = t.name
), S AS (
    SELECT t.name AS tbl, c.name AS col, CAST(ep.value AS nvarchar(400)) AS cmt
    FROM [HSDZ_MES_SRV1015].sys.tables t
    JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id
    LEFT JOIN [HSDZ_MES_SRV1015].sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description'
    JOIN @t f ON f.n = t.name
)
SELECT CASE WHEN ISNULL(l.cmt, N'') = N'' THEN N'本地缺' ELSE N'文案不同' END AS 类别,
       l.tbl AS 表, l.col AS 列, ISNULL(l.cmt, N'(无)') AS 本地注明, ISNULL(s.cmt, N'(无)') AS 快照注明
FROM L l JOIN S s ON s.tbl = l.tbl AND s.col = l.col
WHERE ISNULL(l.cmt, N'') <> ISNULL(s.cmt, N'')
ORDER BY 类别, 表, 列;
