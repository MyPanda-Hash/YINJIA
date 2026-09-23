SET NOCOUNT ON;
SELECT name, type_desc, is_unique, has_filter, filter_definition
  FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.yj_doc_batch') ORDER BY name;
GO
