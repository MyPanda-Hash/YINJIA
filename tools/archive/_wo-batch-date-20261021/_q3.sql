SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col, ty.name AS typ
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('scjl','bd_finish_in','bl_finish_in','wo_progress','qc_first_insp_head','qc_proc_insp_head','qc_asm_insp_head','inh','outh')
ORDER BY t.name, c.column_id;
GO
