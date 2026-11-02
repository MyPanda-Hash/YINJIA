SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name IN (N'批次号',N'批号') AND t.name IN
 ('scjl','plang_pc','wo_progress','qc_first_insp_head','qc_first_insp_detail','qc_proc_insp_head','qc_proc_insp_detail','qc_asm_insp_head','qc_asm_insp_detail','bd_finish_in','bl_finish_in','bd_prod_abn','wo_process_line','wo_mixing_head','yj_doc_batch','inh','outh','kucun')
ORDER BY t.name;
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_finish_in') ORDER BY c.column_id;
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.inh') ORDER BY c.column_id;
GO
SELECT c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.wo_process_line') ORDER BY c.column_id;
GO
