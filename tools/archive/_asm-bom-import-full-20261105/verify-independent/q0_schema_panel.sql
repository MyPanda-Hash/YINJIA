SET NOCOUNT ON;
SELECT name AS col_name, TYPE_NAME(user_type_id) AS type_name, max_length, is_nullable
  FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_panel') ORDER BY column_id;
GO
SELECT name AS col_name, TYPE_NAME(user_type_id) AS type_name, max_length, is_nullable
  FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_field') ORDER BY column_id;
GO
