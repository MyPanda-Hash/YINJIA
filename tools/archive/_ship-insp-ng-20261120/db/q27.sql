SET NOCOUNT ON;
SELECT 总结论, COUNT(*) c FROM qc_proc_insp_head WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 总结论;
SELECT TOP 5 单据编号, 单据日期, 工单号, 总结论, 单据状态 FROM qc_proc_insp_head WHERE 总结论=N'不合格' ORDER BY id DESC;
SELECT TOP 3 单据编号, 出货检验单号, 工单号 FROM qc_bhc ORDER BY id DESC;
