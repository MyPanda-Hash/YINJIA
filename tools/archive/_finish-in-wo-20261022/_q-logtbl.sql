SET NOCOUNT ON;
SELECT '=== 修改留痕表候选 ===' AS s;
SELECT t.name, p.rows FROM sys.tables t
  JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
 WHERE t.name IN (N'yj_doc_modify_log', N'yj_usage_log', N'yj_schema_log', N'yj_doc_annotation');
GO
SELECT '=== yj_doc_modify_log 列 ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, CAST(ep.value AS nvarchar(200)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_doc_modify_log') ORDER BY c.column_id;
GO
SELECT '=== yj_usage_log 列 ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, CAST(ep.value AS nvarchar(200)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_usage_log') ORDER BY c.column_id;
