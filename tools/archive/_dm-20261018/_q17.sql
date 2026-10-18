SET NOCOUNT ON;
PRINT 'A';
SELECT COUNT(*) AS 表 FROM sys.tables WHERE name LIKE 'qc_proc_insp%';
PRINT 'B';
SELECT p.panel_code, p.line_table, p.head_table FROM yj_panel p WHERE p.panel_code = 'QC_PROC_INSP';
