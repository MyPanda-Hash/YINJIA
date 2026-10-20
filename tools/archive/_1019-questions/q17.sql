SELECT c.name, c.is_nullable, dc.definition AS 默认值 FROM sys.columns c
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id
GO
SELECT c.name, c.is_nullable, dc.definition AS 默认值 FROM sys.columns c
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE c.object_id=OBJECT_ID('dbo.yj_translation') ORDER BY c.column_id
