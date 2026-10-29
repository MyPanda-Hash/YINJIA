SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('qc_first_insp_detail','qc_proc_insp_detail','qc_asm_insp_detail')
  AND (c.name LIKE N'%不良%' OR c.name LIKE N'%不合格%' OR c.name LIKE N'%检验数量%' OR c.name LIKE N'%工单行号%')
ORDER BY t.name, c.name;
PRINT '--- row counts ---';
SELECT 'qc_first_insp_head' t, COUNT(*) n FROM qc_first_insp_head
UNION ALL SELECT 'qc_proc_insp_head', COUNT(*) FROM qc_proc_insp_head
UNION ALL SELECT 'qc_asm_insp_head', COUNT(*) FROM qc_asm_insp_head;
