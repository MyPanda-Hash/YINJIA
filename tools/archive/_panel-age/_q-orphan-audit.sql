SET NOCOUNT ON;
-- _q-orphan-audit.sql — 合并后的「孤儿元数据」体检(只读):指向已不存在面板的行
-- 口径:yj_panel 是面板真源;凡 panel_code 在 yj_panel 里找不到的元数据行 = 孤儿(应清理)
SELECT N'① yj_field 孤儿(字段登记指向不存在的面板)' AS 检查项, CAST(COUNT(*) AS nvarchar(10)) AS 值 FROM yj_field f
  WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code)
UNION ALL SELECT N'② yj_role_panel 孤儿(授权指向不存在的面板)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_role_panel r
  WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = r.panel_code)
UNION ALL SELECT N'③ yj_doc_status 孤儿(单据状态指向不存在的面板)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_status s
  WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = s.panel_code)
UNION ALL SELECT N'④ yj_translation 孤儿(panel 名:已无任何面板/字段用)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation t
  WHERE t.scope = 'panel'
    AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = t.ref_key)
UNION ALL SELECT N'⑤ yj_translation 孤儿(field 标签:已无任何字段行用)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_translation t
  WHERE t.scope = 'field'
    AND NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.label = t.ref_key)
UNION ALL SELECT N'⑥ 面板总数(合并后)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_panel
UNION ALL SELECT N'⑦ 字段总数(合并后)', CAST(COUNT(*) AS nvarchar(10)) FROM yj_field;
GO
-- 孤儿明细:哪些面板(按 field/role 行数排序)
SELECT TOP 25 f.panel_code, COUNT(*) AS 字段孤儿行,
       MAX(CASE WHEN EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code) THEN 1 ELSE 0 END) AS 面板存在
FROM yj_field f GROUP BY f.panel_code
HAVING NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code)
ORDER BY COUNT(*) DESC;
GO
-- 孤儿译名样例(panel 名前 20)
SELECT TOP 20 t.ref_key AS 面板名, COUNT(DISTINCT t.locale) AS 语言数
FROM yj_translation t
WHERE t.scope = 'panel' AND NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = t.ref_key)
GROUP BY t.ref_key ORDER BY COUNT(DISTINCT t.locale) DESC, t.ref_key;
