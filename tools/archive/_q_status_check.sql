SET NOCOUNT ON;
PRINT '── 状态推导口径核对(按 erp_close_state/stopped 推导显示态)──';
SELECT panel_code,
  SUM(CASE WHEN ISNULL(s.canceled,'N')='Y' THEN 1 ELSE 0 END) AS 已作废,
  SUM(CASE WHEN ISNULL(s.canceled,'N')<>'Y' AND (ISNULL(s.stopped,'N')='Y' OR s.erp_close_state='H') THEN 1 ELSE 0 END) AS 已中止,
  SUM(CASE WHEN ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.erp_close_state,'')<>'H' AND s.erp_close_state='S' THEN 1 ELSE 0 END) AS 已完成,
  SUM(CASE WHEN ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.erp_close_state,'') NOT IN ('H','S') AND s.shr IS NOT NULL THEN 1 ELSE 0 END) AS 已审核,
  SUM(CASE WHEN ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.erp_close_state,'') NOT IN ('H','S') AND s.shr IS NULL THEN 1 ELSE 0 END) AS 草稿
FROM yj_doc_status s WHERE panel_code IN ('PU_ORDER','SO_ORDER') GROUP BY panel_code;
GO
PRINT '── 抽查:金蝶 H 的单在 MES 里应是 已中止 ──';
SELECT TOP 5 s.doc_no, s.erp_close_state, ISNULL(s.stopped,'N') AS stopped, s.shr FROM yj_doc_status s
WHERE s.panel_code='PU_ORDER' AND s.erp_close_state='H' ORDER BY s.doc_no DESC;
GO
