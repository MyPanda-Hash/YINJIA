SET NOCOUNT ON;
DECLARE @d TABLE(no nvarchar(60) PRIMARY KEY);
INSERT @d SELECT h.单据编号 FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');
SELECT COUNT(*) target_n FROM @d;
GO
SELECT s.doc_no, s.pending, s.shr, s.canceled, s.saved, s.archived, s.deleting, s.modify_state
FROM yj_doc_status s WHERE s.panel_code='QC_INSP'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=s.doc_no AND ISNULL(x.asp_cancel,'N')<>'Y')
AND EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=s.doc_no AND ISNULL(h.asp_cancel,'N')<>'Y') ORDER BY s.doc_no;
GO
SELECT a.form_no, a.action, a.result FROM yj_form_approval a JOIN qc_insp h ON h.单据编号=a.form_no
WHERE a.panel_code='QC_INSP' AND ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');
GO
SELECT l.source_form_no, l.target_panel_code, l.target_form_no FROM form_flow_link l JOIN qc_insp h ON h.单据编号=l.source_form_no
WHERE l.source_panel_code='QC_INSP' AND ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');
GO
SELECT l.target_form_no, l.source_panel_code, l.source_form_no FROM form_flow_link l JOIN qc_insp h ON h.单据编号=l.target_form_no
WHERE l.target_panel_code='QC_INSP' AND ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');
GO
SELECT 'attach' k, COUNT(*) n FROM yj_attachment a JOIN qc_insp h ON h.单据编号=a.doc_no WHERE a.panel_code='QC_INSP' AND ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y')
UNION ALL SELECT 'annot', COUNT(*) FROM yj_doc_annotation a JOIN qc_insp h ON h.单据编号=a.doc_no WHERE a.panel_code='QC_INSP' AND ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y')
UNION ALL SELECT 'qc_return', COUNT(*) FROM qc_return q JOIN qc_insp h ON h.单据编号=q.检验单号 WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y')
UNION ALL SELECT 'qc_tc', COUNT(*) FROM qc_tc_in q JOIN qc_insp h ON h.单据编号=q.检验单号 WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y')
UNION ALL SELECT 'doc_batch', COUNT(*) FROM yj_doc_batch b JOIN qc_insp h ON h.单据编号=b.source_form_no WHERE b.source_panel_code='QC_INSP' AND ISNULL(h.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');
