SET NOCOUNT ON;
SELECT x.id, x.单据编号, x.检验项, ISNULL(r.单据编号,'<MISSING>') parent
FROM qc_insp_rec_detail x LEFT JOIN qc_insp_rec r ON r.单据编号=x.单据编号
ORDER BY x.id;
GO
SELECT 单据编号, 检验数据记录单号 FROM qc_tc_in WHERE ISNULL(检验数据记录单号,'')<>'' ORDER BY 单据编号;
GO
SELECT COUNT(*) status_orphan FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC'
AND NOT EXISTS(SELECT 1 FROM qc_insp_rec r WHERE r.单据编号=s.doc_no);
