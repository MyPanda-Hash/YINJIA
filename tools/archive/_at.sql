SET NOCOUNT ON
SELECT t.name+'|'+c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id ORDER BY t.name
