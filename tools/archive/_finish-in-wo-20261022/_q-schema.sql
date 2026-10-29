SET NOCOUNT ON;
SELECT '=== bd_finish_in columns ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable,
       CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.bd_finish_in') ORDER BY c.column_id;

SELECT '=== bl_finish_in columns ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable,
       CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.bl_finish_in') ORDER BY c.column_id;

SELECT '=== row counts ===' AS s;
SELECT (SELECT COUNT(*) FROM dbo.bd_finish_in) AS 头表行,
       (SELECT COUNT(*) FROM dbo.bl_finish_in) AS 行表行,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号,N'') <> N'') AS 头_有加工单号,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号,N'') = N'') AS 头_无加工单号;
