SET NOCOUNT ON;
SELECT c.name, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.yj_usage_log') ORDER BY c.column_id;
SELECT N'yj_doc_status 列' AS k, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_doc_status') ORDER BY c.column_id;
