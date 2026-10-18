SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name LIKE N'外部%' AND t.name LIKE N'bd[_]%' ORDER BY t.name, c.name;
