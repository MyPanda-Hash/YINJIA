SELECT TOP 40 m.name AS 表名, c.name AS 列名 FROM sys.columns c JOIN sys.objects m ON m.object_id=c.object_id
WHERE m.name='yj_panel' ORDER BY c.column_id
GO
SELECT TOP 100 name FROM sys.objects WHERE type IN ('U') AND name LIKE '%supplier%' ORDER BY name
GO
SELECT name FROM sys.objects WHERE type IN ('U') AND name LIKE 'qc_%' ORDER BY name
