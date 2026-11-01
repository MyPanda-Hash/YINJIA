SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE (t.name='plang_pc' AND c.name IN (N'批次号',N'lot_no',N'plang_id'))
   OR (t.name='wo_progress' AND c.name IN (N'批次号',N'工单行id'))
   OR (t.name='qc_first_insp_head' AND c.name IN (N'批次号',N'工单号',N'工单行号'))
   OR (t.name='qc_proc_insp_head' AND c.name IN (N'批次号',N'工单号',N'工单行号'))
   OR (t.name='qc_asm_insp_head' AND c.name IN (N'批次号',N'工单号',N'工单行号'))
   OR (t.name='bl_finish_in' AND c.name IN (N'批号',N'单据编号'))
ORDER BY t.name,c.name;
GO
