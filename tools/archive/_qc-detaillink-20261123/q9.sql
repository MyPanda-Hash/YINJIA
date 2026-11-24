SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_doc_status') ORDER BY column_id;
