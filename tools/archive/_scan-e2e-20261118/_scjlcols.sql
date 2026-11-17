SET NOCOUNT ON;
SELECT STUFF((SELECT N',' + c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.scjl') ORDER BY c.column_id FOR XML PATH('')),1,1,N'') AS scjl列;
