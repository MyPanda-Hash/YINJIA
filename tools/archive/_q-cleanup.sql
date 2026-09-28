SET NOCOUNT ON;
SELECT 'ACTIVE占用' AS t, COUNT(*) AS n FROM form_flow_link WHERE target_form_no IN ('MO-2026-09-0095','MO-2026-09-0098') AND link_status='ACTIVE';

DELETE FROM bl_manu_order WHERE 合同号 IN ('MO-2026-09-0095','MO-2026-09-0098');
DELETE FROM bd_manu_order WHERE 合同号 IN ('MO-2026-09-0095','MO-2026-09-0098');
DELETE FROM yj_doc_status WHERE panel_code='MANU_ORDER' AND doc_no IN ('MO-2026-09-0095','MO-2026-09-0098');
DELETE FROM form_flow_link WHERE target_form_no IN ('MO-2026-09-0095','MO-2026-09-0098');
DELETE FROM yj_usage_log WHERE doc_no IN ('MO-2026-09-0095','MO-2026-09-0098') AND panel_name IN (N'生产加工单', N'生产工单');

SELECT '单据残留' AS t, COUNT(*) AS n FROM bd_manu_order WHERE 合同号 IN ('MO-2026-09-0095','MO-2026-09-0098');
SELECT '链接残留' AS t, COUNT(*) AS n FROM form_flow_link WHERE target_form_no IN ('MO-2026-09-0095','MO-2026-09-0098');
SELECT 'SO行ACTIVE占用' AS t, COUNT(*) AS n FROM form_flow_link WHERE source_form_no='ZXL-20260916-02' AND link_status='ACTIVE';
