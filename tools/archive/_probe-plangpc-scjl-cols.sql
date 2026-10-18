/* _probe-plangpc-scjl-cols.sql — 只读：导出 plang / plang_pc / scjl 三表列清单(名·型·注明)
   用法(在 tools 目录,必须带 -Dstdout.encoding=UTF-8,否则中文注明在控制台被按 GBK 解码成乱码):
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java "<jdbc>" yinjia <pass> archive\_probe-plangpc-scjl-cols.sql
   ⚠ 库兼容级别=100(SQL2008) ⇒ 不能用 STRING_AGG(报 Incorrect syntax near '(');
     SqlRunner 每个结果集只打印前 50 行 ⇒ 按 column_id 分块(每块 35 列)。 */
SET NOCOUNT ON;

DECLARE @t TABLE (ord int IDENTITY(1,1), tbl sysname);
INSERT INTO @t(tbl) VALUES ('plang'), ('plang_pc'), ('scjl');

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id IN (OBJECT_ID('dbo.plang'), OBJECT_ID('dbo.plang_pc'), OBJECT_ID('dbo.scjl'))
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c WHERE c.column_id BETWEEN 1 AND 35
ORDER BY c.tbl, c.column_id;

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id IN (OBJECT_ID('dbo.plang'), OBJECT_ID('dbo.plang_pc'), OBJECT_ID('dbo.scjl'))
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c WHERE c.column_id BETWEEN 36 AND 70
ORDER BY c.tbl, c.column_id;

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id IN (OBJECT_ID('dbo.plang'), OBJECT_ID('dbo.plang_pc'), OBJECT_ID('dbo.scjl'))
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c WHERE c.column_id BETWEEN 71 AND 105
ORDER BY c.tbl, c.column_id;

;WITH c AS (
  SELECT o.name AS tbl, c.column_id, c.name AS col, ty.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
         CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c
  JOIN sys.objects o ON o.object_id = c.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
  WHERE c.object_id IN (OBJECT_ID('dbo.plang'), OBJECT_ID('dbo.plang_pc'), OBJECT_ID('dbo.scjl'))
)
SELECT c.tbl + ' #' + CAST(c.column_id AS varchar(10)) + ' | ' + c.col + ' | ' + c.typ
       + CASE WHEN c.typ IN ('nvarchar','nchar') THEN '(' + CAST(c.max_length/2 AS varchar(10)) + ')'
              WHEN c.typ IN ('varchar','char','varbinary','binary') THEN '(' + CAST(c.max_length AS varchar(10)) + ')'
              WHEN c.typ IN ('decimal','numeric') THEN '(' + CAST(c.precision AS varchar(10)) + ',' + CAST(c.scale AS varchar(10)) + ')'
              ELSE '' END
       + CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE '' END
       + ' | ' + ISNULL(c.cmt, '') AS colinfo
FROM c WHERE c.column_id BETWEEN 106 AND 140
ORDER BY c.tbl, c.column_id;

SELECT '== 行数 ==' AS section, 'plang=' + CAST((SELECT COUNT(*) FROM dbo.plang) AS varchar(10))
       + ' plang_pc=' + CAST((SELECT COUNT(*) FROM dbo.plang_pc) AS varchar(10))
       + ' scjl=' + CAST((SELECT COUNT(*) FROM dbo.scjl) AS varchar(10)) AS cnts;

SELECT '== 键值实测(最近 5 条 scjl → 排产行 → 工单行) ==' AS section;
SELECT TOP 5 CAST(s.id AS varchar(10)) + ' | 报工单号=' + ISNULL(s.报工单号,'-') + ' | scjl.gd_id=' + CAST(ISNULL(s.gd_id,0) AS varchar(10))
       + ' | pc.id=' + CAST(ISNULL(pc.id,0) AS varchar(10)) + ' | pc.plang_id=' + CAST(ISNULL(pc.plang_id,0) AS varchar(10))
       + ' | pc.pl_no=' + ISNULL(pc.pl_no,'-') + ' | pc.pl_xc=' + CAST(ISNULL(pc.pl_xc,0) AS varchar(10))
       + ' | plang.id=' + CAST(ISNULL(p.id,0) AS varchar(10)) + ' | plang.pl_no=' + ISNULL(p.pl_no,'-') + ' | plang.pl_xc=' + CAST(ISNULL(p.pl_xc,0) AS varchar(10))
       + ' | scjl.gldh=' + ISNULL(s.gldh,'-') + ' | scjl.工单行号=' + CAST(ISNULL(s.工单行号,-1) AS varchar(10))
       + ' | 批次号: scjl=' + ISNULL(s.批次号,'-') + ' pc=' + ISNULL(pc.批次号,'-') + ' plang=' + ISNULL(p.批次号,'-') AS chain
FROM dbo.scjl s
LEFT JOIN dbo.plang_pc pc ON pc.id = s.gd_id
LEFT JOIN dbo.plang p ON p.id = pc.plang_id
ORDER BY s.id DESC;
