SET NOCOUNT ON;
PRINT '===== 面板元数据(相关面板) =====';
SELECT panel_code, panel_name, head_table, line_table, category, mode,
       CASE WHEN config LIKE '%reportQueryDialog%' THEN N'含 reportQueryDialog' ELSE N'' END AS cfg_flag
FROM yj_panel WHERE panel_code IN ('PU_ORDER','QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN');

PRINT '===== QC_RETURN / QC_RECV / QC_INSP 单据总数与作废数 =====';
SELECT 'QC_RETURN' AS p, COUNT(*) AS 表内行数,
       SUM(CASE WHEN ISNULL(s.canceled,'N')='Y' THEN 1 ELSE 0 END) AS 已作废
FROM qc_return r LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=r.单据编号
UNION ALL
SELECT 'QC_RECV', COUNT(*), SUM(CASE WHEN ISNULL(s.canceled,'N')='Y' THEN 1 ELSE 0 END)
FROM qc_recv r LEFT JOIN yj_doc_status s ON s.panel_code='QC_RECV' AND s.doc_no=r.单据编号
UNION ALL
SELECT 'QC_INSP', COUNT(*), SUM(CASE WHEN ISNULL(s.canceled,'N')='Y' THEN 1 ELSE 0 END)
FROM qc_insp r LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=r.单据编号;

PRINT '===== 作废退料单 与其 检验单 的作废时间对照(证明级联) =====';
SELECT r.单据编号 AS 退料单, r.检验单号, CONVERT(varchar(19),rs.cancel_at,120) AS 退料单作废时间, rs.cancel_by AS 退料单操作人,
       CONVERT(varchar(19),is2.cancel_at,120) AS 检验单作废时间, is2.cancel_by AS 检验单操作人,
       DATEDIFF(SECOND, is2.cancel_at, rs.cancel_at) AS 相差秒,
       (SELECT TOP 1 link_status FROM form_flow_link l WHERE l.target_panel_code='QC_RETURN' AND l.target_form_no=r.单据编号) AS 链路状态
FROM qc_return r
LEFT JOIN yj_doc_status rs ON rs.panel_code='QC_RETURN' AND rs.doc_no=r.单据编号
LEFT JOIN yj_doc_status is2 ON is2.panel_code='QC_INSP' AND is2.doc_no=r.检验单号
WHERE ISNULL(rs.canceled,'N')='Y' ORDER BY r.单据编号;
