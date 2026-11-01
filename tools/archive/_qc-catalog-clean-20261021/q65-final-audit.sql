SET NOCOUNT ON;
SELECT form_no, action, result, node_no, operator, opinion, create_time
FROM yj_form_approval WHERE panel_code='QC_INSP'
AND form_no IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') ORDER BY form_no, id;
GO
SELECT h.单据编号, h.审核人, h.审核时间, s.shr, s.shsj, s.pending, s.saved, s.archived, s.canceled
FROM qc_insp h JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE h.单据编号 IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') ORDER BY h.单据编号;
GO
SELECT COUNT(*) draft_left FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(s.shr,'')='' AND ISNULL(s.pending,'N')<>'Y' AND ISNULL(s.archived,'N')<>'Y' AND ISNULL(s.canceled,'N')<>'Y';
