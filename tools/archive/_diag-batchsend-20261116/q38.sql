SET NOCOUNT ON;
SELECT COUNT(*) AS 本地残留DZ FROM yj_doc_status WHERE ISNULL(erp_close_state,N'') IN (N'D',N'Z');
SELECT doc_no, panel_code, erp_close_state FROM yj_doc_status WHERE doc_no LIKE N'%GUARD%' OR doc_no LIKE N'%-合单B';
SELECT doc_no, erp_close_state FROM yj_doc_status WHERE panel_code=N'PU_ORDER' AND doc_no=N'YJ-20260916-01';
