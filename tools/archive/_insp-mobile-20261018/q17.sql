SET NOCOUNT ON;
SELECT 单据编号, 工单号, 工单行号, 工序, 批次号, 生产日期, 报工数量, 检验员 FROM dbo.qc_first_insp_head WHERE 单据编号 IN (N'SJ-2026-10-0062',N'SJ-2026-10-0063');
GO
