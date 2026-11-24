SET NOCOUNT ON;
SELECT TOP 8 h.单据编号, h.单据日期 FROM qc_insp h
 WHERE ISNULL(h.asp_cancel,'N')<>'Y'
   AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=h.单据编号 AND ISNULL(s.canceled,'N')='Y')
 ORDER BY h.id DESC;
SELECT TOP 3 单据编号 FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' AND s.doc_no=qc_insp_rec.单据编号 AND ISNULL(s.canceled,'N')='Y') ORDER BY id DESC;
