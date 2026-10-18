SET NOCOUNT ON;
SELECT 单据编号, 工单号, 工单行号, 工序, 批次号 FROM dbo.qc_first_insp_head WHERE 工单号=N'GD-2026-10-0220';
GO
SELECT 单据编号, 工单号, 工单行号, 工序, 批次号 FROM dbo.qc_proc_insp_head WHERE 工单号=N'GD-2026-10-0220';
GO
