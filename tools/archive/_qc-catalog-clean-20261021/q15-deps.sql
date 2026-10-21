SET NOCOUNT ON;
SELECT form_no, action, result, operator, create_time FROM yj_form_approval WHERE panel_code='QC_INSP_REC' ORDER BY form_no;
GO
SELECT panel_code, doc_no, COUNT(*) n FROM yj_attachment WHERE panel_code IN ('QC_INSP_REC','QC_CATALOG') GROUP BY panel_code,doc_no;
GO
SELECT panel_code, doc_no, COUNT(*) n FROM yj_doc_annotation WHERE panel_code IN ('QC_INSP_REC','QC_CATALOG') GROUP BY panel_code,doc_no;
GO
SELECT 单据编号, 检验数据记录单号 FROM qc_tc_in WHERE ISNULL(检验数据记录单号,'')<>'' ORDER BY 单据编号;
