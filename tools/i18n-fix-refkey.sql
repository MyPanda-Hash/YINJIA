-- 修正:翻译键统一为"中文原文"(字段标签/面板名),跨面板共享译名,与前端 biz 词典同构
USE HSDZ_MES;
DELETE FROM yj_translation;
GO
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT DISTINCT 'field', f.label, 'en', f.label_en, 'manual'
FROM yj_field f WHERE f.label_en IS NOT NULL;
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT DISTINCT 'panel', p.panel_name, 'en', p.panel_name_en, 'manual'
FROM yj_panel p WHERE p.panel_name_en IS NOT NULL;
GO
SELECT scope, locale, COUNT(*) AS cnt FROM yj_translation GROUP BY scope, locale;
GO
