SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_user') ORDER BY c.column_id;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_role') ORDER BY c.column_id;
