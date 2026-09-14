SET NOCOUNT ON;
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + N'SELECT ' + QUOTENAME(t.name, '''') + N' AS tbl, COUNT(*) AS n FROM ' + QUOTENAME(t.name) + N' UNION ALL ' + CHAR(10)
FROM sys.tables t
WHERE t.name NOT IN (SELECT name FROM [36.140.66.163].HSDZ_MES.sys.tables);
SET @sql = LEFT(@sql, LEN(@sql) - LEN('UNION ALL ' + CHAR(10)));
EXEC sp_executesql @sql;