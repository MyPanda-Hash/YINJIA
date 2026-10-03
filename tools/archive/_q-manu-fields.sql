SET NOCOUNT ON;
SELECT 合同号 FROM bd_manu_order WHERE 合同号 IN ('MO-2026-09-0095','MO-2026-09-0098');
SELECT '占用残留' AS t, COUNT(*) AS n FROM form_flow_link WHERE target_form_no IN ('MO-2026-09-0095','MO-2026-09-0098');
SELECT '面板名' AS t, panel_code, panel_name FROM yj_panel WHERE panel_code IN ('MANU_ORDER','MANU_ORDER_DETAIL','MANU_ORDER_STATS','WO_ORDER');
SELECT '重复字段行' AS t, col_name, place, COUNT(*) AS n FROM yj_field WHERE panel_code='MANU_ORDER' GROUP BY col_name, place HAVING COUNT(*)>1;
SELECT '列表列数' AS t, COUNT(*) AS n FROM yj_field WHERE panel_code='MANU_ORDER' AND place LIKE '%query%';
SELECT '明细位数' AS t, COUNT(*) AS n FROM yj_field WHERE panel_code='MANU_ORDER' AND place LIKE '%detail%';
