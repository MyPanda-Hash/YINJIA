/* _probe-plangpc-scjl-cols2.sql — 只读：补齐上一支探针被「每结果集 50 行」截掉的列区间
   (scjl #36-70 / scjl #94-120 / plang_pc #51-70) */
SET NOCOUNT ON;

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id = OBJECT_ID('dbo.scjl') AND c.column_id BETWEEN 36 AND 70
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c ORDER BY c.column_id;

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id = OBJECT_ID('dbo.scjl') AND c.column_id BETWEEN 94 AND 130
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c ORDER BY c.column_id;

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id = OBJECT_ID('dbo.plang_pc') AND c.column_id BETWEEN 51 AND 80
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c ORDER BY c.column_id;

SELECT '== 列数 ==' AS section,
       'plang=' + CAST((SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.plang')) AS varchar(10))
       + ' plang_pc=' + CAST((SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.plang_pc')) AS varchar(10))
       + ' scjl=' + CAST((SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.scjl')) AS varchar(10)) AS v;
