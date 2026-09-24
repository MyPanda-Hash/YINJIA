SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('qc_insp_rec') ORDER BY c.column_id;
GO
