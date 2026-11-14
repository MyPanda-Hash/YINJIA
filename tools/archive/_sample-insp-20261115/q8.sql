SELECT data_type, COUNT(*) AS n FROM yj_field GROUP BY data_type ORDER BY n DESC;
SELECT '=== sample label with slash/paren ===' AS x;
SELECT TOP 5 panel_code, label, data_type FROM yj_field WHERE data_type=N'小数';
