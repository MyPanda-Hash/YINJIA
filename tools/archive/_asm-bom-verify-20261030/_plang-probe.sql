SET NOCOUNT ON;
SELECT 'plang列' AS what, c.name AS col, t.name AS typ
FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.plang') ORDER BY c.column_id;
GO
SELECT TOP 5 * FROM plang;
GO
