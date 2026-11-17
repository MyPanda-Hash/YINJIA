SET NOCOUNT ON;
SELECT c.name, t.name typ, c.max_length
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID(N'dbo.yj_doc_status') ORDER BY c.column_id;
SELECT TOP 5 * FROM yj_doc_status WHERE panel_code=N'INSP_COMMISSION';
GO
