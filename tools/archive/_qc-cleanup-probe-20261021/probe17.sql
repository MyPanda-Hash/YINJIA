SET NOCOUNT ON;
SELECT c.name, ty.name typ, c.is_nullable, c.is_identity, dc.definition AS dflt
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id=OBJECT_ID('s_allno') ORDER BY c.column_id;
GO
