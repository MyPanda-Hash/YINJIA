SET NOCOUNT ON;
/* 调试:对 bd_dispatch.单据编号 / bd_pu_order.汇率 / bl_dispatch.备注 打印全部属性,两侧对照 */
;WITH L AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           c.column_id AS cid, ISNULL(c.collation_name, N'') AS coll
    FROM [HSDZ_MES].sys.tables t
    JOIN [HSDZ_MES].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
), S AS (
    SELECT t.name AS tbl, c.name AS col, ty.name AS typ,
           CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS len,
           c.precision AS prec, c.scale AS sc, c.is_nullable AS nullable, c.is_identity AS ident,
           c.column_id AS cid, ISNULL(c.collation_name, N'') AS coll
    FROM [HSDZ_MES_SRV1015].sys.tables t
    JOIN [HSDZ_MES_SRV1015].sys.columns c ON c.object_id = t.object_id
    JOIN [HSDZ_MES_SRV1015].sys.types ty ON ty.user_type_id = c.user_type_id
)
SELECT l.tbl AS 表, l.col AS 列,
       l.typ AS 本地类型, l.len AS 本地长, l.prec AS 本地精度, l.sc AS 本地小数,
       l.nullable AS 本地可空, l.ident AS 本地自增, l.cid AS 本地列序,
       s.typ AS 快照类型, s.len AS 快照长, s.prec AS 快照精度, s.sc AS 快照小数,
       s.nullable AS 快照可空, s.ident AS 快照自增, s.cid AS 快照列序,
       CASE WHEN l.coll = s.coll THEN N'同' ELSE N'异:' + l.coll + N'/' + s.coll END AS 排序规则
FROM L l JOIN S s ON s.tbl = l.tbl AND s.col = l.col
WHERE (l.tbl = N'bd_dispatch' AND l.col IN (N'单据编号', N'单据日期'))
   OR (l.tbl = N'bd_pu_order' AND l.col = N'汇率')
   OR (l.tbl = N'bl_dispatch' AND l.col IN (N'备注', N'单据编号'))
   OR (l.tbl = N'bd_manu_order' AND l.col = N'附件1')
ORDER BY l.tbl, l.col;
