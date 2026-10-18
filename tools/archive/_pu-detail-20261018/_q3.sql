SET NOCOUNT ON;
SELECT col_name, label, data_type, place, seq FROM yj_field WHERE panel_code='PU_ORDER' AND seq <= 120 ORDER BY seq;
PRINT '--- 单据状态取值分布 ---';
SELECT 单据状态, COUNT(*) n FROM bd_pu_order GROUP BY 单据状态 ORDER BY n DESC;
PRINT '--- yj_doc_status 对 PU_ORDER 的登记 ---';
SELECT COUNT(*) AS 登记行, SUM(CASE WHEN ISNULL(canceled,'N')='Y' THEN 1 ELSE 0 END) AS 已作废 FROM yj_doc_status WHERE panel_code='PU_ORDER';
