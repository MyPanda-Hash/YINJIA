SET NOCOUNT ON;
SELECT h.单据编号, h.审核人, h.审核时间, s.shr, s.pending, s.approve_node, s.saved
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE h.单据编号 IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') ORDER BY h.单据编号;
GO
SELECT source_form_no, target_form_no, link_status, linked_quantity, inventory_code
FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN'
AND source_form_no IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') ORDER BY source_form_no,target_form_no;
