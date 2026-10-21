SET NOCOUNT ON;
SELECT h.单据编号, ISNULL(h.asp_cancel,'N') c, s.doc_no status_doc, s.canceled, s.saved, s.shr
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
ORDER BY h.单据编号;
