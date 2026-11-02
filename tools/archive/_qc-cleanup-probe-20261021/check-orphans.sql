SET NOCOUNT ON;
SELECT 'orphan return status' k, COUNT(*) n FROM yj_doc_status s WHERE s.panel_code='QC_RETURN'
 AND NOT EXISTS (SELECT 1 FROM qc_return r WHERE r.单据编号=s.doc_no)
UNION ALL SELECT 'orphan return links', COUNT(*) FROM form_flow_link l WHERE l.target_panel_code='QC_RETURN'
 AND NOT EXISTS (SELECT 1 FROM qc_return r WHERE r.单据编号=l.target_form_no)
UNION ALL SELECT 'orphan return modlog', COUNT(*) FROM yj_doc_modify_log m WHERE m.panel_code='QC_RETURN'
 AND NOT EXISTS (SELECT 1 FROM qc_return r WHERE r.单据编号=m.doc_no)
UNION ALL SELECT 'orphan return detail', COUNT(*) FROM qc_return_detail d WHERE NOT EXISTS (SELECT 1 FROM qc_return r WHERE r.单据编号=d.单据编号);
GO
