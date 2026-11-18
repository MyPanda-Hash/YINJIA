SET NOCOUNT ON;
SELECT 单据编号, 外部数据ID, CASE WHEN 外部指纹 IS NULL THEN N'空' ELSE N'有' END AS 指纹, asp_cancel
FROM bd_pu_order WHERE 单据编号 IN (N'YJ-20261109-03', N'YJ-20260901-03');
GO
SELECT doc_no, erp_close_state FROM yj_doc_status WHERE doc_no IN (N'YJ-20261109-03', N'YJ-20260901-03');
GO
SELECT COUNT(*) AS 残留标记 FROM yj_doc_status WHERE erp_close_state IN (N'D', N'Z');
