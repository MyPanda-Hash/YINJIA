SET NOCOUNT ON;
SELECT c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('s_allno') ORDER BY c.column_id;
GO
SELECT TOP 5 * FROM s_allno;
GO
