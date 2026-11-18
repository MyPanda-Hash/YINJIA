SET NOCOUNT ON;
SELECT id, 检验项, 检测标准, 检验方法, 结果1, 结果5, 结果6, 结果7, asp_cancel FROM dbo.qc_insp_rec_detail WHERE 单据编号 = N'JYSJ-2026-11-0021' ORDER BY id;
SELECT 单据编号, 结果列数 FROM dbo.qc_insp_rec WHERE 单据编号 = N'JYSJ-2026-11-0021';
