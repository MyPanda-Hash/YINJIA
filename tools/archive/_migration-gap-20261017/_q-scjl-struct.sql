SET NOCOUNT ON;
/* ============ scjl 完整结构比对:当前正式库 HSDZ_MES  vs  服务器快照 HSDZ_MES_SRV1015 ============ */

/* ① 列级:列名/顺序/类型/长度/精度/可空/自增/计算列/默认值/排序规则 —— 逐列全字段比对 */
;WITH A AS (
    SELECT c.column_id, c.name,
           ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           c.is_computed AS comp, ISNULL(OBJECT_DEFINITION(c.default_object_id), N'') AS def,
           ISNULL(c.collation_name, N'') AS coll
    FROM [HSDZ_MES].sys.columns c
    JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id
    WHERE t.name = N'scjl'
), B AS (
    SELECT c.column_id, c.name,
           ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           c.is_computed AS comp, ISNULL(OBJECT_DEFINITION(c.default_object_id), N'') AS def,
           ISNULL(c.collation_name, N'') AS coll
    FROM [HSDZ_MES_SRV1015].sys.columns c
    JOIN [HSDZ_MES_SRV1015].sys.types ty ON ty.user_type_id = c.user_type_id
    JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = c.object_id
    WHERE t.name = N'scjl'
)
SELECT ISNULL(a.column_id, b.column_id) AS 序,
       ISNULL(a.name, b.name) AS 列名,
       a.typ AS 正式类型,     b.typ AS 快照类型,
       a.len AS 正式长,       b.len AS 快照长,
       a.prec AS 正式精度,    b.prec AS 快照精度,
       a.sc AS 正式小数,      b.sc AS 快照小数,
       a.nullable AS 正式可空, b.nullable AS 快照可空,
       a.ident AS 正式自增,   b.ident AS 快照自增,
       a.def AS 正式默认,     b.def AS 快照默认,
       a.coll AS 正式排序,    b.coll AS 快照排序
FROM A a FULL JOIN B b ON b.column_id = a.column_id
WHERE a.name IS NULL OR b.name IS NULL
   OR a.name <> b.name OR a.typ <> b.typ OR a.len <> b.len OR a.prec <> b.prec OR a.sc <> b.sc
   OR a.nullable <> b.nullable OR a.ident <> b.ident OR a.comp <> b.comp OR a.def <> b.def OR a.coll <> b.coll;
-- 无输出 = 列级 100% 一致

/* ② 索引 / 主键 */
SELECT N'正式库' AS 库, i.name AS 索引名, i.type_desc AS 类型, i.is_primary_key AS 主键,
       i.is_unique AS 唯一, ISNULL(i.filter_definition, N'') AS 筛选,
       STUFF((SELECT N',' + c2.name FROM [HSDZ_MES].sys.index_columns ic2
               JOIN [HSDZ_MES].sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
              WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0
              ORDER BY ic2.key_ordinal FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 1, N'') AS 键列
FROM [HSDZ_MES].sys.indexes i JOIN [HSDZ_MES].sys.tables t ON t.object_id = i.object_id
WHERE t.name = N'scjl' AND i.type > 0
UNION ALL
SELECT N'服务器快照', i.name, i.type_desc, i.is_primary_key, i.is_unique, ISNULL(i.filter_definition, N''),
       STUFF((SELECT N',' + c2.name FROM [HSDZ_MES_SRV1015].sys.index_columns ic2
               JOIN [HSDZ_MES_SRV1015].sys.columns c2 ON c2.object_id = ic2.object_id AND c2.column_id = ic2.column_id
              WHERE ic2.object_id = i.object_id AND ic2.index_id = i.index_id AND ic2.is_included_column = 0
              ORDER BY ic2.key_ordinal FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 1, N'') 
FROM [HSDZ_MES_SRV1015].sys.indexes i JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = i.object_id
WHERE t.name = N'scjl' AND i.type > 0;

/* ③ 中文注明:表级 + 列级,只列差异 */
SELECT ISNULL(a.k, b.k) AS 对象段,
       a.txt AS 正式库注明, b.txt AS 快照注明
FROM (
    SELECT N'表' + N'|' + N'(table)' AS k, CAST(ep.value AS nvarchar(400)) AS txt
    FROM [HSDZ_MES].sys.extended_properties ep JOIN [HSDZ_MES].sys.tables t ON t.object_id = ep.major_id
    WHERE t.name = N'scjl' AND ep.name = N'MS_Description' AND ep.minor_id = 0
    UNION ALL
    SELECT N'列|' + c.name, CAST(ep.value AS nvarchar(400))
    FROM [HSDZ_MES].sys.extended_properties ep
    JOIN [HSDZ_MES].sys.tables t ON t.object_id = ep.major_id
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE t.name = N'scjl' AND ep.name = N'MS_Description' AND ep.minor_id > 0
) a
FULL JOIN (
    SELECT N'表' + N'|' + N'(table)' AS k, CAST(ep.value AS nvarchar(400)) AS txt
    FROM [HSDZ_MES_SRV1015].sys.extended_properties ep JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = ep.major_id
    WHERE t.name = N'scjl' AND ep.name = N'MS_Description' AND ep.minor_id = 0
    UNION ALL
    SELECT N'列|' + c.name, CAST(ep.value AS nvarchar(400))
    FROM [HSDZ_MES_SRV1015].sys.extended_properties ep
    JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = ep.major_id
    JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = ep.major_id AND c.column_id = ep.minor_id
    WHERE t.name = N'scjl' AND ep.name = N'MS_Description' AND ep.minor_id > 0
) b ON b.k = a.k
WHERE a.k IS NULL OR b.k IS NULL OR a.txt <> b.txt;

/* ④ 汇总计数 */
SELECT
  (SELECT COUNT(*) FROM [HSDZ_MES].sys.columns c JOIN [HSDZ_MES].sys.tables t ON t.object_id=c.object_id WHERE t.name=N'scjl') AS 正式列数,
  (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].sys.columns c JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id=c.object_id WHERE t.name=N'scjl') AS 快照列数,
  (SELECT COUNT(*) FROM [HSDZ_MES].sys.indexes i JOIN [HSDZ_MES].sys.tables t ON t.object_id=i.object_id WHERE t.name=N'scjl' AND i.type>0) AS 正式索引数,
  (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].sys.indexes i JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id=i.object_id WHERE t.name=N'scjl' AND i.type>0) AS 快照索引数,
  (SELECT COUNT(*) FROM [HSDZ_MES].sys.extended_properties ep JOIN [HSDZ_MES].sys.tables t ON t.object_id=ep.major_id WHERE t.name=N'scjl' AND ep.name=N'MS_Description') AS 正式注明数,
  (SELECT COUNT(*) FROM [HSDZ_MES_SRV1015].sys.extended_properties ep JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id=ep.major_id WHERE t.name=N'scjl' AND ep.name=N'MS_Description') AS 快照注明数;
