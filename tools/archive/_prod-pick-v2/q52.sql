SET NOCOUNT ON;
SELECT c.name AS col, c.is_nullable, c.max_length FROM sys.columns c WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
