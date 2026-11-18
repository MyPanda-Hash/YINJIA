SET NOCOUNT ON;
SELECT c.name, t.name AS typ, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.yj_field') ORDER BY c.column_id;
GO
