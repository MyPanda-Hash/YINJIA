SET NOCOUNT ON;
PRINT '── 探针遗留单据排查(单号前缀) ──';
SELECT 'sl_recv' AS t, 单据编号, 单据状态, 采购订单号, asp_cancel FROM sl_recv WHERE 单据编号 LIKE 'SL-2026-09-000%'
UNION ALL SELECT 'qc_insp', 单据编号, 单据状态, 采购订单号, asp_cancel FROM qc_insp WHERE 单据编号 LIKE 'IJ-2026-09-000%'
UNION ALL SELECT 'bd_purchase_in', 单据编号, 单据状态, 采购订单号, asp_cancel FROM bd_purchase_in WHERE 单据编号 LIKE 'PI-2026-09-%'
ORDER BY t, 单据编号;
GO
PRINT '── 活跃占用(探针链路) ──';
SELECT source_panel_code, source_form_no, target_panel_code, target_form_no, link_status FROM form_flow_link
WHERE link_status='ACTIVE' AND (source_form_no LIKE 'SL-2026-09-000%' OR source_form_no LIKE 'IJ-2026-09-000%' OR target_form_no LIKE 'PI-2026-09-%' OR target_form_no LIKE 'IJ-2026-09-000%' OR target_form_no LIKE 'SL-2026-09-000%');
GO
