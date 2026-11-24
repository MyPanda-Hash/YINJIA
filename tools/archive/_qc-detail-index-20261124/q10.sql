SET NOCOUNT ON;
SELECT TOP 10 h.单据编号, h.单据日期, ISNULL(h.asp_cancel,'N') AS asp_cancel, s.canceled
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE ISNULL(s.canceled,'N')='Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
ORDER BY h.id DESC;
