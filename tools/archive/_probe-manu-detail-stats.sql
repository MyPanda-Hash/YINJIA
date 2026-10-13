SET NOCOUNT ON;
PRINT '=== 1. 面板 yj_panel ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, module_group FROM yj_panel
WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS');

PRINT '=== 2. 字段数 yj_field ===';
SELECT panel_code, COUNT(*) AS field_cnt FROM yj_field
WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS') GROUP BY panel_code;

PRINT '=== 3. 视图对象 ===';
SELECT name, type_desc, create_date, modify_date FROM sys.objects
WHERE name IN ('v_manu_order_detail','v_manu_order_stats');

PRINT '=== 4. 视图行数 ===';
SELECT 'v_manu_order_detail' AS obj, COUNT(*) AS rows_cnt FROM v_manu_order_detail
UNION ALL SELECT 'v_manu_order_stats', COUNT(*) FROM v_manu_order_stats;

PRINT '=== 5. 依赖:谁引用这两个视图 ===';
SELECT refing = OBJECT_NAME(d.referencing_id), refed = d.referenced_entity_name, d.referenced_class_desc
FROM sys.sql_expression_dependencies d
WHERE d.referenced_entity_name IN ('v_manu_order_detail','v_manu_order_stats');

PRINT '=== 5b. 这两个视图依赖谁 ===';
SELECT refing = OBJECT_NAME(d.referencing_id), refed = d.referenced_entity_name
FROM sys.sql_expression_dependencies d
WHERE OBJECT_NAME(d.referencing_id) IN ('v_manu_order_detail','v_manu_order_stats');

PRINT '=== 6. 权限行 yj_role_panel ===';
SELECT panel_code, COUNT(*) AS role_cnt FROM yj_role_panel
WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS') GROUP BY panel_code;

PRINT '=== 7. 翻译行 yj_translation(panel scope) ===';
SELECT ref_key, COUNT(*) AS n FROM yj_translation
WHERE scope='panel' AND ref_key IN (N'生产工单明细表', N'生产工单统计表') GROUP BY ref_key;

PRINT '=== 8. 按钮 yj_button(若有 panel_code) ===';
SELECT panel_code, COUNT(*) AS n FROM yj_button
WHERE panel_code IN ('MANU_ORDER_DETAIL','MANU_ORDER_STATS') GROUP BY panel_code;

PRINT '=== 9. 其它可能引用面板码的元数据表 ===';
SELECT t.name AS tbl, c.name AS col, cnt = NULL FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE c.name LIKE '%panel%' AND t.name LIKE 'yj_%' ORDER BY t.name;
