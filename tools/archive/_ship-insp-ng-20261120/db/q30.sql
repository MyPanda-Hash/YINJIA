SET NOCOUNT ON;
SELECT TOP 3 单据编号, 单据日期, 出货检验单号, 工单号, 客户名称, 产品编码, 产品名称, 产品规格, 生产量, 不合格品数量, 不合格品比例, 责任部门, 责任人, 单据状态
FROM qc_bhc WHERE 单据编号=N'BHC-2026-11-0003';
SELECT 单据编号, 总结论, 工单号, 产品编码, 产品名称, 规格型号, 检验数量, 客户名称 FROM qc_proc_insp_head WHERE 单据编号=N'ZC-2026-10-0131';
SELECT ISNULL(SUM(ISNULL(不良数量,0)),0) AS ng FROM qc_proc_insp_detail WHERE 单据编号=N'ZC-2026-10-0131';
