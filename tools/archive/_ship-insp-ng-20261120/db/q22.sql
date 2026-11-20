SET NOCOUNT ON;
SELECT dc.name AS constraint_name, c.name AS column_name, dc.definition
FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('qc_bhc');
