SET NOCOUNT ON;
SELECT '=== inh 列（只看名字/类型/注释） ===' AS s;
SELECT c.column_id, c.name, ty.name AS type,
       CAST(ep.value AS nvarchar(200)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.inh') ORDER BY c.column_id;
GO
SELECT '=== inh 里 2 路(产成品入库) 样例 ===' AS s;
SELECT TOP 10 * FROM dbo.inh WHERE src = 2 ORDER BY id DESC;
GO
SELECT '=== scjl 列 ===' AS s;
SELECT c.column_id, c.name, ty.name AS type,
       CAST(ep.value AS nvarchar(200)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.scjl') ORDER BY c.column_id;
