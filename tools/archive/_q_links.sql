SET NOCOUNT ON;
SELECT source_panel_code, source_form_no, target_panel_code, target_form_no, link_status FROM form_flow_link
WHERE source_form_no='YJ-20260915-06' OR target_form_no LIKE 'SL-2026-09-000%' OR target_form_no LIKE 'IJ-2026-09-000%' OR target_form_no LIKE 'PI-2026-09-%'
ORDER BY source_form_no, target_form_no;
GO
