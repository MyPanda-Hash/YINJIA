SET NOCOUNT ON;
SELECT DISTINCT TOP 5 [单据编号],[工单号],[工单行号] FROM dbo.v_qc_asm_insp_detail WHERE [工单行id] IS NULL ORDER BY [单据编号];
SELECT TOP 6 [单据编号],[工单号],[工单行号],[工单行id] FROM dbo.v_qc_proc_insp_detail ORDER BY [单据日期] DESC;
