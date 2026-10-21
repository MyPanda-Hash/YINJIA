SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE '%insp%' OR name LIKE '%catalog%' ORDER BY name;
SELECT name FROM sys.views WHERE name LIKE '%insp%' OR name LIKE '%catalog%' ORDER BY name;
