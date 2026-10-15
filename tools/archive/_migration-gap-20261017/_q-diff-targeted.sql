SET NOCOUNT ON;
DECLARE @t TABLE (n sysname);
INSERT INTO @t (n) VALUES (N'dm_langue'), (N'gscs'), (N'permission'), (N's_commdata'),
                          (N's_sys'), (N's_xtcs'), (N'inh'), (N'outh'), (N'scjl'), (N'out');

/* 0. 这 9 张表在两边是否存在 */
SELECT v.n AS 表,
       CASE WHEN EXISTS (SELECT 1 FROM [HSDZ_MES].sys.tables WHERE name = v.n) THEN N'有' ELSE N'无' END AS 本地正式库,
       CASE WHEN EXISTS (SELECT 1 FROM [HSDZ_MES_SRV1015].sys.tables WHERE name = v.n) THEN N'有' ELSE N'无' END AS 服务器快照
FROM @t v;

/* 1. 列级差异(三个方向) */
;WITH L AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar')
                     THEN CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length / 2 AS nvarchar(10)) END
                ELSE CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length AS nvarchar(10)) END END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           (SELECT dc.definition FROM [HSDZ_MES].sys.default_constraints dc WHERE dc.object_id = c.default_object_id) AS def,
           CASE WHEN EXISTS (SELECT 1 FROM [HSDZ_MES].sys.extended_properties ep
                              WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description')
                THEN N'有' ELSE N'无' END AS cmt
    FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN @t f ON f.n = t.name
), S AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar')
                     THEN CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length / 2 AS nvarchar(10)) END
                ELSE CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length AS nvarchar(10)) END END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           (SELECT dc.definition FROM [HSDZ_MES_SRV1015].sys.default_constraints dc WHERE dc.object_id = c.default_object_id) AS def,
           CASE WHEN EXISTS (SELECT 1 FROM [HSDZ_MES_SRV1015].sys.extended_properties ep
                              WHERE ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = N'MS_Description')
                THEN N'有' ELSE N'无' END AS cmt
    FROM [HSDZ_MES_SRV1015].sys.tables t
    JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES_SRV1015].sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN @t f ON f.n = t.name
)
SELECT N'①快照有·本地无' AS 类别, s.tbl AS 表, s.col AS 列, N'(无此列)' AS 本地定义,
       (s.typ + N'(' + s.len + N')' + CASE WHEN s.nullable = 0 THEN N' NOT NULL' ELSE N'' END) AS 快照定义, N'' AS 差异点
FROM S s WHERE NOT EXISTS (SELECT 1 FROM L l WHERE l.tbl = s.tbl AND l.col = s.col)
UNION ALL
SELECT N'②本地有·快照无', l.tbl, l.col,
       (l.typ + N'(' + l.len + N')' + CASE WHEN l.nullable = 0 THEN N' NOT NULL' ELSE N'' END), N'(无此列)', N''
FROM L l WHERE NOT EXISTS (SELECT 1 FROM S s WHERE s.tbl = l.tbl AND s.col = l.col)
UNION ALL
SELECT N'③定义不同', l.tbl, l.col,
       (l.typ + N'(' + l.len + N')' + CASE WHEN l.nullable = 0 THEN N' NOT NULL' ELSE N'' END),
       (s.typ + N'(' + s.len + N')' + CASE WHEN s.nullable = 0 THEN N' NOT NULL' ELSE N'' END),
       STUFF(CASE WHEN l.typ <> s.typ THEN N',类型' ELSE N'' END
           + CASE WHEN l.len <> s.len THEN N',长度' ELSE N'' END
           + CASE WHEN l.prec <> s.prec OR l.sc <> s.sc THEN N',精度(' + CAST(l.prec AS nvarchar(5)) + N'.' + CAST(l.sc AS nvarchar(5)) + N'→' + CAST(s.prec AS nvarchar(5)) + N'.' + CAST(s.sc AS nvarchar(5)) + N')' ELSE N'' END
           + CASE WHEN l.nullable <> s.nullable THEN N',可空' ELSE N'' END
           + CASE WHEN l.ident <> s.ident THEN N',自增' ELSE N'' END
           + CASE WHEN ISNULL(l.def, N'') <> ISNULL(s.def, N'') THEN N',默认值(' + ISNULL(l.def, N'无') + N'→' + ISNULL(s.def, N'无') + N')' ELSE N'' END
           + CASE WHEN l.cmt <> s.cmt THEN N',中文注明(' + l.cmt + N'→' + s.cmt + N')' ELSE N'' END, 1, 1, N'')
FROM S s JOIN L l ON l.tbl = s.tbl AND l.col = s.col
WHERE l.typ <> s.typ OR l.len <> s.len OR l.prec <> s.prec OR l.sc <> s.sc
   OR l.nullable <> s.nullable OR l.ident <> s.ident
   OR ISNULL(l.def, N'') <> ISNULL(s.def, N'') OR l.cmt <> s.cmt
ORDER BY 类别, 表, 列;

/* 2. 每表列数汇总 */
;WITH L AS (
    SELECT t.name AS tbl, COUNT(*) AS n FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id JOIN @t f ON f.n = t.name GROUP BY t.name
), S AS (
    SELECT t.name AS tbl, COUNT(*) AS n FROM [HSDZ_MES_SRV1015].sys.tables t
    JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id JOIN @t f ON f.n = t.name GROUP BY t.name
)
SELECT ISNULL(l.tbl, s.tbl) AS 表, ISNULL(l.n, 0) AS 本地列数, ISNULL(s.n, 0) AS 快照列数,
       CASE WHEN ISNULL(l.n, 0) = ISNULL(s.n, 0) THEN N'列数相同' ELSE N'★列数不同' END AS 判定
FROM L l FULL JOIN S s ON s.tbl = l.tbl ORDER BY 表;

/* 3. 索引 / 主键差异 */
SELECT N'本地' AS 库, t.name AS 表, i.name AS 索引名, i.type_desc AS 类型, i.is_primary_key AS 主键, i.is_unique AS 唯一
FROM [HSDZ_MES].sys.tables t JOIN [HSDZ_MES].sys.indexes i ON i.object_id = t.object_id AND i.type > 0
WHERE t.name IN (N'dm_langue', N'gscs', N'permission', N's_commdata', N's_sys', N's_xtcs', N'inh', N'outh', N'scjl')
UNION ALL
SELECT N'快照', t.name, i.name, i.type_desc, i.is_primary_key, i.is_unique
FROM [HSDZ_MES_SRV1015].sys.tables t JOIN [HSDZ_MES_SRV1015].sys.indexes i ON i.object_id = t.object_id AND i.type > 0
WHERE t.name IN (N'dm_langue', N'gscs', N'permission', N's_commdata', N's_sys', N's_xtcs', N'inh', N'outh', N'scjl')
ORDER BY 表, 索引名, 库;
