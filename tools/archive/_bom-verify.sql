-- 探针:BOM_KD 迁移结果核验
SELECT '=== 1. 表与列数 ===' AS x;
SELECT t.name AS tbl, (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS cols,
       (SELECT CAST(ep.value AS nvarchar(200)) FROM sys.extended_properties ep WHERE ep.major_id = t.object_id AND ep.minor_id = 0 AND ep.name='MS_Description') AS 表注明
FROM sys.tables t WHERE t.name IN ('bs_bom_head','bs_bom_detail');
GO
SELECT '=== 2. 面板行 ===' AS x;
SELECT panel_code, panel_name, panel_name_en, category, mode, head_table, line_table, group_col, pk_col, code_col, date_col, page_size, detail_key, module_group FROM yj_panel WHERE panel_code='BOM_KD';
GO
SELECT '=== 3. 字段数/place 分布 ===' AS x;
SELECT COUNT(*) AS fields, SUM(CASE WHEN place LIKE '%header%' THEN 1 ELSE 0 END) AS hdr,
       SUM(CASE WHEN place LIKE '%detail%' AND place NOT LIKE '%header%' THEN 1 ELSE 0 END) AS dtl,
       SUM(CASE WHEN place LIKE '%query%' THEN 1 ELSE 0 END) AS qry
FROM yj_field WHERE panel_code='BOM_KD';
GO
SELECT '=== 4. 缺 en 译名的标签 ===' AS x;
SELECT f.label FROM yj_field f WHERE f.panel_code='BOM_KD'
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en');
GO
SELECT '=== 5. 列悬空(字段指向不存在的物理列) ===' AS x;
SELECT f.col_name, f.place FROM yj_field f WHERE f.panel_code='BOM_KD'
  AND ((f.place LIKE '%header%' AND COL_LENGTH(N'dbo.bs_bom_head', f.col_name) IS NULL)
    OR (f.place LIKE '%detail%' AND f.place NOT LIKE '%header%' AND COL_LENGTH(N'dbo.bs_bom_detail', f.col_name) IS NULL));
GO
SELECT '=== 6. 关键列注明抽查 ===' AS x;
SELECT t.name AS tbl, c.name AS col, CAST(ep.value AS nvarchar(120)) AS cmt
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
LEFT JOIN sys.extended_properties ep ON ep.major_id=c.object_id AND ep.minor_id=c.column_id AND ep.name='MS_Description'
WHERE t.name IN ('bs_bom_head','bs_bom_detail') AND c.name IN (N'单据编号', N'成品率', N'材料用量', N'发料方式', N'外部数据ID');
GO
SELECT '=== 7. 面板译名 ===' AS x;
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'BOM单', N'成品率', N'发料方式') ORDER BY ref_key, scope, locale;
