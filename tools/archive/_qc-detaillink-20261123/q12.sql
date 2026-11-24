SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, asp_cancel FROM dbo.plang WHERE pl_no IN (N'GD-2026-10-0002', N'GD-2026-10-0221', N'GD-2026-11-0023');
SELECT COUNT(*) AS asm_null_lineid_rows,
       COUNT(DISTINCT [单据编号]) AS asm_null_docs
  FROM dbo.v_qc_asm_insp_detail WHERE [工单行id] IS NULL;
SELECT DISTINCT [单据编号],[工单号],[工单行号] FROM dbo.v_qc_asm_insp_detail WHERE [工单行id] IS NULL;
