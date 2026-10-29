SET NOCOUNT ON;
SELECT '=== bl_material_out columns ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable,
       CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.bl_material_out') ORDER BY c.column_id;
SELECT '=== bd_material_out columns ===' AS s;
SELECT c.column_id, c.name, ty.name AS type, c.max_length, c.precision, c.scale, c.is_nullable,
       CAST(ep.value AS nvarchar(300)) AS cmt
  FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
 WHERE c.object_id = OBJECT_ID(N'dbo.bd_material_out') ORDER BY c.column_id;
SELECT '=== sample bl_material_out ===' AS s;
SELECT TOP 3 * FROM dbo.bl_material_out ORDER BY id DESC;
SELECT '=== outh.rid join check ===' AS s;
SELECT COUNT(*) AS src6_rows, COUNT(b.id) AS matched_rid FROM dbo.outh o
  LEFT JOIN dbo.bl_material_out b ON b.id = o.rid WHERE o.src = 6;
