SET NOCOUNT ON;
SELECT c.column_id AS ord, c.name AS col, t.name AS typ
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.bd_material_ret') ORDER BY c.column_id;
GO
SET NOCOUNT ON;
SELECT c.column_id AS ord, c.name AS col, t.name AS typ
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.wo_pick_return') ORDER BY c.column_id;
