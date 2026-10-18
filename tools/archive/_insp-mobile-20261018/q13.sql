SET NOCOUNT ON;
SELECT TOP 8 单据编号, 工单号, 工单行号, 工序, 批次号, 报工数量, 检验员, asp_time1 FROM dbo.qc_first_insp_head ORDER BY id DESC;
GO
SELECT TOP 8 单据编号, 工单号, 工单行号, 工序, 批次号, 报工数量, 检验类别, 检验员, asp_time1 FROM dbo.qc_proc_insp_head ORDER BY id DESC;
GO
SELECT TOP 5 单据编号, 工单号, 工单行号, 工序, 批次号, 报工数量, 检验员, asp_time1 FROM dbo.qc_asm_insp_head ORDER BY id DESC;
GO
PRINT '--- first insp detail rows for newest ---';
SELECT TOP 6 单据编号, 项次, 样品, 检验项目, 检验要求 FROM dbo.qc_first_insp_detail WHERE 单据编号 = (SELECT TOP 1 单据编号 FROM dbo.qc_first_insp_head ORDER BY id DESC) ORDER BY id;
GO
