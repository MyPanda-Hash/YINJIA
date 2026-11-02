SET NOCOUNT ON;
SELECT t.name tbl, c.name col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE (t.name='plang' AND c.name IN (N'pl_no',N'源工单号',N'根工单号'))
   OR (t.name='plang_pc' AND c.name=N'pl_no')
   OR (t.name='scjl' AND c.name IN (N'gldh',N'tm'))
   OR (t.name='wo_progress' AND c.name=N'单据编号')
   OR (t.name IN ('qc_first_insp_head','qc_proc_insp_head','qc_asm_insp_head') AND c.name=N'工单号')
   OR (t.name='bd_finish_in' AND c.name=N'加工单号')
   OR (t.name='bd_material_out' AND c.name IN (N'加工单号',N'来源单号'))
   OR (t.name='bl_material_out' AND c.name=N'加工单号')
   OR (t.name='wo_process_line' AND c.name=N'工单号')
   OR (t.name='wo_transfer_log' AND c.name=N'pl_no')
   OR (t.name='s_allno' AND c.name IN (N'dh',N'ny'))
   OR (t.name='form_flow_link' AND c.name IN (N'source_form_no',N'target_form_no',N'source_line_key',N'target_line_key'))
   OR (t.name='yj_usage_log' AND c.name=N'doc_no')
ORDER BY t.name,c.name;
GO
