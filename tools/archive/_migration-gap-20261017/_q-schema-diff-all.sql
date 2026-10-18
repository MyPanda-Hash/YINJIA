SET NOCOUNT ON;
/* 全库结构比对(修正版):[HSDZ_MES] 本地正式库 vs [HSDZ_MES_SRV1015] 服务器快照
   修正:① nvarchar(max)/varchar(max) 的 max_length=-1 显式映射为 '(max)';
        ② 默认值按**各自库**取 sys.default_constraints,不再跨库调 OBJECT_DEFINITION。 */
;WITH L AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar')
                     THEN CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length / 2 AS nvarchar(10)) END
                ELSE CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length AS nvarchar(10)) END END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           (SELECT dc.definition FROM [HSDZ_MES].sys.default_constraints dc WHERE dc.object_id = c.default_object_id) AS def,
           c.column_id AS cid
    FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
), S AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar')
                     THEN CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length / 2 AS nvarchar(10)) END
                ELSE CASE WHEN c.max_length = -1 THEN N'(max)' ELSE CAST(c.max_length AS nvarchar(10)) END END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           (SELECT dc.definition FROM [HSDZ_MES_SRV1015].sys.default_constraints dc WHERE dc.object_id = c.default_object_id) AS def,
           c.column_id AS cid
    FROM [HSDZ_MES_SRV1015].sys.tables t
    JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES_SRV1015].sys.types ty ON ty.user_type_id = c.user_type_id
)
SELECT N'①快照有·本地无' AS 类别, s.tbl AS 表, s.col AS 列,
       N'' AS 本地定义, (s.typ + N'(' + s.len + N')' + CASE WHEN s.nullable = 0 THEN N' NOT NULL' ELSE N'' END) AS 快照定义, N'' AS 差异点
FROM S s
WHERE EXISTS (SELECT 1 FROM L l WHERE l.tbl = s.tbl)
  AND NOT EXISTS (SELECT 1 FROM L l WHERE l.tbl = s.tbl AND l.col = s.col)

UNION ALL

SELECT N'②两边不同', s.tbl, s.col,
       (l.typ + N'(' + l.len + N')' + CASE WHEN l.nullable = 0 THEN N' NOT NULL' ELSE N'' END),
       (s.typ + N'(' + s.len + N')' + CASE WHEN s.nullable = 0 THEN N' NOT NULL' ELSE N'' END),
       STUFF(CASE WHEN l.typ <> s.typ THEN N',类型' ELSE N'' END
           + CASE WHEN l.len <> s.len THEN N',长度' ELSE N'' END
           + CASE WHEN l.prec <> s.prec OR l.sc <> s.sc THEN N',精度' ELSE N'' END
           + CASE WHEN l.nullable <> s.nullable THEN N',可空' ELSE N'' END
           + CASE WHEN l.ident <> s.ident THEN N',自增' ELSE N'' END
           + CASE WHEN ISNULL(l.def, N'') <> ISNULL(s.def, N'') THEN N',默认值' ELSE N'' END, 1, 1, N'')
FROM S s JOIN L l ON l.tbl = s.tbl AND l.col = s.col
WHERE l.typ <> s.typ OR l.len <> s.len OR l.prec <> s.prec OR l.sc <> s.sc
   OR l.nullable <> s.nullable OR l.ident <> s.ident
   OR ISNULL(l.def, N'') <> ISNULL(s.def, N'')
ORDER BY 类别, 表, 列;
