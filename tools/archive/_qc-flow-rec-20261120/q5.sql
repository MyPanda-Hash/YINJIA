SELECT COUNT(*) AS n, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS canceled FROM qc_insp_rec;
GO
SELECT TOP 10 单据编号, 单据日期, 来料检验单号, 物料编码, 物料批次, 检验结论, 检验人, 表单审核人 FROM qc_insp_rec ORDER BY id DESC;
GO
SELECT COUNT(*) AS n FROM qc_insp_rec_detail;
GO
SELECT TOP 5 d.单据编号, d.检验项, d.检测标准, d.检测结果, d.单项判定, d.asp_cancel FROM qc_insp_rec_detail d ORDER BY d.id DESC;
GO
SELECT TOP 5 s.doc_no, s.panel_code, s.shr, s.canceled, s.pending FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' ORDER BY s.id DESC;
