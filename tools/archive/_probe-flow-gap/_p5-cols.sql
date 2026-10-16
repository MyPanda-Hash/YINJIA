SET NOCOUNT ON;
PRINT '=== plang columns ===';
SELECT c.name, t.name AS type, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('plang') ORDER BY c.column_id;
GO
PRINT '=== plang_pc columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('plang_pc') ORDER BY c.column_id;
GO
PRINT '=== qc_first_insp_head columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_first_insp_head') ORDER BY c.column_id;
GO
PRINT '=== qc_first_insp_detail columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_first_insp_detail') ORDER BY c.column_id;
GO
PRINT '=== qc_proc_insp_head columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_proc_insp_head') ORDER BY c.column_id;
GO
PRINT '=== scjl columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('scjl') ORDER BY c.column_id;
GO
