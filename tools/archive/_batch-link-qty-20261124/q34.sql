SET NOCOUNT ON;
-- 本地有没有「草稿态暂收单 + ACTIVE 占用」可用来验证保存回写
SELECT TOP 10 f.target_form_no AS 暂收单, s.shr, s.saved, s.canceled, COUNT(*) AS 占用行数
  FROM form_flow_link f
  JOIN yj_doc_status s ON s.panel_code='QC_RECV' AND s.doc_no=f.target_form_no
 WHERE f.target_panel_code='QC_RECV' AND f.link_status='ACTIVE'
 GROUP BY f.target_form_no, s.shr, s.saved, s.canceled
 ORDER BY f.target_form_no DESC;
