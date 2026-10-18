SET NOCOUNT ON;
SELECT 单据编号, 工单号, 批次号, asp_user1, asp_time1 FROM dbo.qc_first_insp_head WHERE 单据编号 IN (N'SJ-2026-10-0062',N'SJ-2026-10-0063');
GO
SELECT 单据编号, 工单号, 批次号, asp_user1, asp_time1 FROM dbo.qc_proc_insp_head WHERE 单据编号 IN (N'ZC-2026-10-0030',N'ZC-2026-10-0031',N'ZC-2026-10-0032');
GO
