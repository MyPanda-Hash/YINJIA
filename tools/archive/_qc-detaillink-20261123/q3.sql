SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.plang') ORDER BY column_id;
SELECT COUNT(*) plang_rows FROM dbo.plang;
SELECT COUNT(*) plangpc_rows FROM dbo.plang_pc;
