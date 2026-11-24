SET NOCOUNT ON;
SELECT COUNT(*) AS detail_rows FROM v_qc_insp_rec_detail;
SELECT TOP 5 检验数据记录单号, 来料检验单号, 物料名称, 检验状态 FROM v_qc_insp_rec_detail ORDER BY 单据日期 DESC;
SELECT COUNT(*) AS rec_rows FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y';
