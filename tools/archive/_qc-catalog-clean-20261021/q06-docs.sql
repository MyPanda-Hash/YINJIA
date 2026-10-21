SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 供应商, 批次号, 检验日期, 单据状态, 审核时间, 暂收单号, 数量, asp_cancel
FROM qc_insp ORDER BY 单据编号;
GO
SELECT 单据编号, 物料编码, 物料名称, 批次号, 数量, 送检数量, 单位, 计量单位, 合格数量, 不良数量, asp_cancel
FROM qc_insp_detail ORDER BY 单据编号, id;
GO
SELECT 单据编号, 单据日期, 物料编码, 物料名称, 物料批次, 来料数量, 计量单位, 检验日期, 来料检验单号, 检验结论, asp_cancel, asp_user1
FROM qc_insp_rec ORDER BY 单据编号;
