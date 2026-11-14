SELECT TOP 20 panel_code, col_name, label FROM yj_field WHERE label LIKE N'%（%)%' OR label LIKE N'%（%）%' ORDER BY panel_code;
SELECT '=== count ===' AS x;
SELECT COUNT(*) AS n FROM yj_field WHERE label LIKE N'%（%）%';
SELECT '=== slash labels ===' AS x;
SELECT TOP 10 panel_code, col_name, label FROM yj_field WHERE label LIKE N'%/%';
