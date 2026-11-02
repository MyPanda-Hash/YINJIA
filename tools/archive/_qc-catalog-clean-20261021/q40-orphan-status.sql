SET NOCOUNT ON;
SELECT s.doc_no, s.pending, s.shr, s.canceled, s.saved, s.archived, s.deleting, s.modify_state
FROM yj_doc_status s WHERE s.panel_code='QC_INSP'
AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=s.doc_no) ORDER BY s.doc_no;
GO
SELECT l.source_form_no, l.target_panel_code, l.target_form_no, l.link_status
FROM form_flow_link l WHERE l.source_panel_code='QC_INSP'
AND NOT EXISTS(SELECT 1 FROM qc_insp h WHERE h.单据编号=l.source_form_no) ORDER BY l.source_form_no;
