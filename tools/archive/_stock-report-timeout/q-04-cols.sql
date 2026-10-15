SET NOCOUNT ON;
GO
SELECT c.name, TYPE_NAME(c.system_type_id) AS t FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
GO
