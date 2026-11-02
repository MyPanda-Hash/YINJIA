SET NOCOUNT ON;
-- 删占用
DELETE f FROM form_flow_link f
 WHERE f.source_panel_code=N'SO_ORDER' AND f.target_panel_code IN (N'MANU_ORDER',N'PLANG')
   AND EXISTS (SELECT 1 FROM plang p WHERE p.pl_no LIKE N'GD-2026-10-%'
                AND (f.target_form_no=p.pl_no OR f.target_line_key LIKE p.pl_no+N'#%'))
   AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 LIKE N'GD-2026-10-%' AND d.状态<>N'已作废');
SELECT '清占用' k, @@ROWCOUNT n;
-- 删工序台账
DELETE w FROM wo_process_line w
 WHERE EXISTS (SELECT 1 FROM plang p WHERE p.pl_no LIKE N'GD-2026-10-%' AND w.工单号=p.pl_no);
-- 删工单
DELETE FROM plang WHERE pl_no LIKE N'GD-2026-10-%'
   AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号=plang.pl_no AND d.状态<>N'已作废');
SELECT '清工单' k, @@ROWCOUNT n;
