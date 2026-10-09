SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE '%dict%' OR name LIKE '%zdgl%' OR name LIKE '%zd%' ORDER BY name;
GO
