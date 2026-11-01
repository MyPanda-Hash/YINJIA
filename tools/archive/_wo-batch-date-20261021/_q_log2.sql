SET NOCOUNT ON;
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
GO
SELECT * FROM dbo.yj_schema_log WHERE 1=0;
GO
