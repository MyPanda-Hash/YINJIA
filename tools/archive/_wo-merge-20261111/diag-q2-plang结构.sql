SELECT c.name AS col, t.name AS typ, c.max_length, c.is_nullable, c.is_identity
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.plang') ORDER BY c.column_id;
GO
SELECT i.name, i.is_unique, i.is_primary_key, COL_NAME(ic.object_id, ic.column_id) AS col
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
WHERE i.object_id = OBJECT_ID('dbo.plang') ORDER BY i.name, ic.key_ordinal;
GO
