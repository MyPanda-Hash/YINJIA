SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE 'bl_%' ORDER BY name;
