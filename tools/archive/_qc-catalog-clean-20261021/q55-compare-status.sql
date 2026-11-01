SET NOCOUNT ON;
SELECT doc_no, shr, approve_node, pending_by, pending_at, saved, archived FROM yj_doc_status WHERE panel_code='QC_INSP' AND doc_no IN ('IJ-2026-10-0003','IJ-2026-10-0005') ORDER BY doc_no;
