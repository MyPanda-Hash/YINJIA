SET NOCOUNT ON;
/* scjl 列清单(当前正式库) */
SELECT c.column_id AS 序, c.name AS 列名, ty.name AS 类型,
       CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS 长度
FROM [HSDZ_MES].sys.columns c
JOIN [HSDZ_MES].sys.types ty ON ty.user_type_id = c.user_type_id
JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id
WHERE t.name = N'scjl' ORDER BY c.column_id;

/* 列顺序是否一致(逐位比对) */
SELECT a.column_id AS 序,
       a.name AS 正式列, b.name AS 快照列,
       CASE WHEN a.name = b.name THEN N'一致' ELSE N'★不同' END AS 判定
FROM (SELECT ROW_NUMBER() OVER (ORDER BY c.column_id) AS rn, c.column_id, c.name
        FROM [HSDZ_MES].sys.columns c JOIN [HSDZ_MES].sys.tables t ON t.object_id = c.object_id
       WHERE t.name = N'scjl') a
FULL JOIN (SELECT ROW_NUMBER() OVER (ORDER BY c.column_id) AS rn, c.column_id, c.name
             FROM [HSDZ_MES_SRV1015].sys.columns c JOIN [HSDZ_MES_SRV1015].sys.tables t ON t.object_id = c.object_id
            WHERE t.name = N'scjl') b ON b.rn = a.rn
WHERE ISNULL(a.name, N'') <> ISNULL(b.name, N'');
