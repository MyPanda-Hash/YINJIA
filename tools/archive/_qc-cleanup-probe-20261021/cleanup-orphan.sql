SET NOCOUNT ON;
DELETE a FROM yj_form_approval a WHERE a.panel_code='QC_INSP'
 AND NOT EXISTS (SELECT 1 FROM qc_insp h WHERE h.单据编号=a.form_no);
DELETE a FROM yj_form_approval a WHERE a.panel_code='QC_RETURN'
 AND NOT EXISTS (SELECT 1 FROM qc_return h WHERE h.单据编号=a.form_no);
DELETE a FROM yj_form_approval a WHERE a.panel_code='QC_INSP_REC'
 AND NOT EXISTS (SELECT 1 FROM qc_insp_rec h WHERE h.单据编号=a.form_no);
DELETE a FROM yj_form_approval a WHERE a.panel_code='QC_CATALOG'
 AND NOT EXISTS (SELECT 1 FROM qc_catalog h WHERE h.单据编号=a.form_no);
SELECT 'insp approvals' k, COUNT(*) n FROM yj_form_approval WHERE panel_code='QC_INSP'
UNION ALL SELECT 'return approvals', COUNT(*) FROM yj_form_approval WHERE panel_code='QC_RETURN'
UNION ALL SELECT 'rec approvals', COUNT(*) FROM yj_form_approval WHERE panel_code='QC_INSP_REC'
UNION ALL SELECT 'catalog approvals', COUNT(*) FROM yj_form_approval WHERE panel_code='QC_CATALOG';
GO
