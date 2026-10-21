SET NOCOUNT ON;
SELECT OBJECT_NAME(referencing_id) AS referencing, referenced_entity_name, referenced_class_desc
  FROM sys.sql_expression_dependencies
 WHERE referenced_entity_name = N'wo_mixing_list';
SELECT name, is_disabled FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.wo_mixing_list');
SELECT COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_mixing_list'), N'id', 'IsIdentity') AS id_identity;
