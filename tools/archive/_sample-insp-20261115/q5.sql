SELECT DISTINCT lb FROM s_allno ORDER BY lb;
SELECT '=== roles ===' AS x;
SELECT r.id, r.role_name FROM yj_role r ORDER BY r.id;
SELECT '=== role_panel QC_INSP / QC_LINE_PATROL / QC_OQC_REPORT ===' AS x;
SELECT panel_code, role_id, can_approve, perms FROM yj_role_panel WHERE panel_code IN (N'QC_INSP', N'QC_LINE_PATROL', N'QC_OQC_REPORT') ORDER BY panel_code, role_id;
SELECT '=== QC_LINE_PATROL panel fields count ===' AS x;
SELECT place, COUNT(*) AS n FROM yj_field WHERE panel_code=N'QC_LINE_PATROL' GROUP BY place;
