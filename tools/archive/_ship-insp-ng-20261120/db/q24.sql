SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE t.name IN ('qc_proc_insp_detail','qc_asm_insp_detail')
  AND c.name IN (N'不良数量',N'不合格数量',N'单据编号')
ORDER BY t.name, c.name;
