SET NOCOUNT ON;
SELECT 'before' AS t, doc_no, ISNULL(erp_close_state,'(null)') AS close_state, ISNULL(stopped,'N') AS stopped, update_at
FROM yj_doc_status WHERE panel_code='PU_ORDER' ORDER BY update_at DESC, doc_no DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;
GO
