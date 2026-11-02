SET NOCOUNT ON;
-- 这次手工清:SO_ORDER 占用里,目标工单已不存在的(= 孤儿占用)
DELETE f FROM form_flow_link f
 WHERE f.source_panel_code = N'SO_ORDER'
   AND f.target_panel_code IN (N'MANU_ORDER', N'PLANG')
   AND NOT EXISTS (SELECT 1 FROM plang p
                    WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
                      AND (f.target_form_no = p.pl_no
                           OR f.target_line_key LIKE p.pl_no + N'#%'));
SELECT '清理后 SO占用行' k, COUNT(*) n FROM form_flow_link
 WHERE source_panel_code='SO_ORDER' AND target_panel_code IN ('MANU_ORDER','PLANG');
