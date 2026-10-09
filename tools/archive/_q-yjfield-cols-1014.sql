SET NOCOUNT ON;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
