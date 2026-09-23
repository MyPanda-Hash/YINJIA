SET NOCOUNT ON;
SELECT c.name, t.name AS type, c.is_nullable FROM sys.columns c
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('yj_field') ORDER BY c.column_id;
GO
