-- BOM_KD 收尾核验(夹具已清;金蝶侧 0 条 ⇒ 两表应为空)
SELECT '=== 行数 ===' AS x;
SELECT (SELECT COUNT(*) FROM bs_bom_head) AS bs_bom_head, (SELECT COUNT(*) FROM bs_bom_detail) AS bs_bom_detail,
       (SELECT COUNT(*) FROM yj_doc_status WHERE panel_code = 'BD_BOM') AS doc_status;
GO
SELECT '=== 面板与字段 ===' AS x;
SELECT p.panel_code, p.panel_name, p.mode, p.head_table, p.line_table,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS fields
FROM yj_panel p WHERE p.panel_code = 'BOM_KD';
