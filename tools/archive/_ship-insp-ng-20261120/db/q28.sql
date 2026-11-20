SET NOCOUNT ON;
SELECT 单据编号, 总结论, 单据状态 FROM qc_proc_insp_head WHERE 单据编号=N'ZC-2026-11-0008';
SELECT TOP 5 单据编号, 出货检验单号, 工单号, 单据日期 FROM qc_bhc ORDER BY id DESC;
