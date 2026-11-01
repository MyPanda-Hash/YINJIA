SET NOCOUNT ON;
SELECT h.单据编号, h.审核人, h.审核时间, h.审批人, h.审批时间, s.shr, s.pending, s.approve_node, s.saved
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE h.单据编号='IJ-2026-09-0152';
GO
SELECT 单据编号, 来源单号, 单据日期, 单据状态, ISNULL(asp_cancel,'N') c FROM bl_purchase_in WHERE 来源单号='IJ-2026-09-0152';
GO
SELECT source_form_no,target_form_no,link_status,linked_quantity FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no='IJ-2026-09-0152';
