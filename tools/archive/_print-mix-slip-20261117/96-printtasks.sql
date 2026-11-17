SET NOCOUNT ON;
SELECT STUFF((SELECT N',' + c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_print_task') ORDER BY c.column_id FOR XML PATH('')),1,1,N'') AS 列;
GO
SELECT * FROM yj_print_task;
