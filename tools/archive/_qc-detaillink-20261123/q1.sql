SET NOCOUNT ON;
SELECT DB_NAME() AS db;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.qc_asm_insp_head') ORDER BY column_id;
