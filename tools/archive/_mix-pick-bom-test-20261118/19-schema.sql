SET NOCOUNT ON;
SELECT STUFF((SELECT N',' + c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id FOR XML PATH('')),1,1,N'') AS yj_schema_log列;
GO
SELECT name AS 含bom含draft的表 FROM sys.tables WHERE name LIKE N'%bom%' OR name LIKE N'%draft%' ORDER BY name;
