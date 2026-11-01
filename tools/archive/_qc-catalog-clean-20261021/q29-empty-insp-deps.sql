SET NOCOUNT ON;
DECLARE @d TABLE(no nvarchar(60) PRIMARY KEY);
INSERT @d SELECT h.单据编号 FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
AND NOT EXISTS(SELECT 1 FROM qc_insp_detail x WHERE x.单据编号=h.单据编号 AND ISNULL(x.asp_cancel,'N')<>'Y');

SELECT 'status' k, s.doc_no, s.pending, s.shr, s.canceled, s.saved, s.archived, s.deleting, s.modify_state FROM yj_doc_status s JOIN @d d ON d.no=s.doc_no WHERE s.panel_code='QC_INSP' ORDER BY s.doc_no;
SELECT 'approval' k, a.form_no, a.action, a.result FROM yj_form_approval a JOIN @d d ON d.no=a.form_no WHERE a.panel_code='QC_INSP';
SELECT 'flow_src' k, l.source_form_no, l.target_panel_code, l.target_form_no FROM form_flow_link l JOIN @d d ON d.no=l.source_form_no WHERE l.source_panel_code='QC_INSP';
SELECT 'flow_tgt' k, l.target_form_no, l.source_panel_code, l.source_form_no FROM form_flow_link l JOIN @d d ON d.no=l.target_form_no WHERE l.target_panel_code='QC_INSP';
SELECT 'attach' k, panel_code, doc_no, COUNT(*) n FROM yj_attachment WHERE panel_code='QC_INSP' GROUP BY panel_code,doc_no;
SELECT 'annot' k, panel_code, doc_no, COUNT(*) n FROM yj_doc_annotation WHERE panel_code='QC_INSP' GROUP BY panel_code,doc_no;
SELECT 'qc_return' k, COUNT(*) n FROM qc_return q JOIN @d d ON d.no=q.检验单号;
SELECT 'qc_tc' k, COUNT(*) n FROM qc_tc_in q JOIN @d d ON d.no=q.检验单号;
SELECT 'batch' k, COUNT(*) n FROM yj_doc_batch b JOIN @d d ON d.no=b.doc_no WHERE b.panel_code='QC_INSP';
