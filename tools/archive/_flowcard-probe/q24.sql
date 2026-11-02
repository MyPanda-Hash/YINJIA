SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('qc_first_insp_head','qc_proc_insp_head','qc_asm_insp_head')
  AND (c.name LIKE N'%行号%' OR c.name LIKE N'%报工%' OR c.name LIKE N'%工序%' OR c.name LIKE N'%批次%')
ORDER BY t.name, c.name;
PRINT '--- sample qc_proc_insp_head cols ---';
SELECT TOP 3 * FROM qc_proc_insp_head ORDER BY id DESC;
