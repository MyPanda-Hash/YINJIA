SET NOCOUNT ON;
SELECT c.name, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.s_allno') ORDER BY c.column_id;
SELECT TOP 8 * FROM s_allno ORDER BY 1 DESC;
