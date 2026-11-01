SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM qc_insp) insp, (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code='QC_INSP') st,
 (SELECT COUNT(*) FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=s.doc_no)) orphan;
