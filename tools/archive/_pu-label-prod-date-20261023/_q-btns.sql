SELECT name FROM sys.tables WHERE name LIKE N'yj_%' AND (name LIKE N'%act%' OR name LIKE N'%tool%' OR name LIKE N'%menu%') ORDER BY name;
