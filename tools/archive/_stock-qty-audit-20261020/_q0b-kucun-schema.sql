SET NOCOUNT ON;
SELECT c.name, t.name AS typ, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
