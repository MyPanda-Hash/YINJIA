SET NOCOUNT ON;
SELECT 单据编号, 单据日期, 供应商, 单据状态, 审核人, 审核时间, asp_user1, asp_time1
FROM bd_pu_order WHERE 外部数据ID IS NULL ORDER BY 单据编号;
GO
SELECT d.panel_code, d.doc_no, d.shr, d.canceled, d.stopped, d.erp_close_state
FROM yj_doc_status d JOIN bd_pu_order o ON o.单据编号 = d.doc_no
WHERE o.外部数据ID IS NULL;
GO
SELECT o.单据编号, COUNT(*) AS 行数 FROM bl_pu_order o
JOIN bd_pu_order h ON h.单据编号 = o.单据编号 AND h.外部数据ID IS NULL
GROUP BY o.单据编号;
