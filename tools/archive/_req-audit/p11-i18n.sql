SET NOCOUNT ON;
PRINT N'=== 1. 研发管理面板名译名覆盖(panel scope) ===';
SELECT p.panel_code, p.panel_name,
       SUM(CASE WHEN t.locale='en' THEN 1 ELSE 0 END) AS en,
       COUNT(t.locale) AS locales
FROM yj_panel p LEFT JOIN yj_translation t ON t.scope='panel' AND t.ref_key=p.panel_name
WHERE p.module_group=N'研发管理' GROUP BY p.panel_code, p.panel_name ORDER BY p.panel_code;
GO
PRINT N'=== 2. 关键标签译名覆盖 ===';
SELECT f.label,
       (SELECT COUNT(DISTINCT locale) FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label) AS field_locales,
       (SELECT COUNT(DISTINCT locale) FROM yj_translation t WHERE t.scope='ui' AND t.ref_key=f.label) AS ui_locales
FROM (SELECT DISTINCT label FROM yj_field WHERE panel_code IN ('RD_PROD_INFO','RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_DOM_TEST','RD_PLAN','RD_PROGRESS','RD_APPROVAL')) f
ORDER BY field_locales, f.label;
GO
PRINT N'=== 3. 四级/项目定级/项目层级 译名 ===';
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'四级',N'项目定级',N'项目层级',N'项目(一/二级)',N'二级',N'三级',N'一二级') ORDER BY ref_key, scope, locale;
GO
PRINT N'=== 4. yj_locale 语言清单 ===';
SELECT locale, name_zh, enabled, sort FROM yj_locale ORDER BY sort;
GO
PRINT N'=== 5. 检验频率/检验类别/检测频率 译名 ===';
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key IN (N'检验频率',N'检测频率',N'检验类别',N'必测项',N'型式检验') ORDER BY ref_key, locale;
