SET NOCOUNT ON;
SELECT action,result,COUNT(*) n FROM yj_form_approval GROUP BY action,result ORDER BY action,result;
GO
SELECT TOP 20 * FROM yj_form_approval WHERE panel_code='QC_INSP' ORDER BY id DESC;
GO
SELECT TOP 20 单据编号,审核人,审核时间,审批人,审批时间,单据状态 FROM qc_return WHERE 单据状态=N'已审核' ORDER BY 单据编号 DESC;
GO
