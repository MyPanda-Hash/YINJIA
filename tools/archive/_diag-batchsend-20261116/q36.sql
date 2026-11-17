SET NOCOUNT ON;
SELECT panel_code, doc_no, shr, shsj, canceled, stopped, pending, erp_close_state, update_at
FROM yj_doc_status WHERE panel_code = N'PU_ORDER' AND doc_no = N'YJ-20260916-01';
GO
SELECT panel_code, doc_no, erp_close_state, update_at FROM yj_doc_status
WHERE ISNULL(erp_close_state,N'') IN (N'D',N'Z') ORDER BY update_at DESC;
