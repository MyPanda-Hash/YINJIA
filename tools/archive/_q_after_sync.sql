SET NOCOUNT ON;
SELECT doc_no, ISNULL(erp_close_state,'(null)') AS 关闭状态, ISNULL(stopped,'N') AS stopped, ISNULL(stop_by,'(空)') AS stop_by, update_at
FROM yj_doc_status WHERE panel_code='PU_ORDER' AND doc_no IN ('YJ-20260916-02','YJ-20260916-04','YJ-20260916-01');
GO
