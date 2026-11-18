SET NOCOUNT ON;
SELECT c.name, t.name AS typ, c.precision, c.scale, c.is_nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('scjl') ORDER BY c.column_id;
GO
SELECT TOP 10 * FROM scjl WHERE sc_date >= '2026-10-21' AND sc_date < '2026-10-22';
GO
