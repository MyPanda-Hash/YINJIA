SET NOCOUNT ON;
UPDATE yj_doc_status SET erp_close_state = NULL WHERE panel_code = N'PU_ORDER' AND doc_no = N'YJ-20260916-01';
SELECT @@ROWCOUNT AS 已还原;
SELECT COUNT(*) AS 残留DZ FROM yj_doc_status WHERE ISNULL(erp_close_state,N'') IN (N'D',N'Z');
