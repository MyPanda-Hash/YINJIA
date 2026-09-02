SET NOCOUNT ON;
INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at)
SELECT DISTINCT 'field', s.ref_key, s.locale, s.text, 'mt', SYSDATETIME(), SYSDATETIME()
FROM yj_translation s
WHERE s.scope IN ('ui','panel') AND s.locale IN ('en','ja','ko','de','es','fr','ru','th','vi','zh-TW')
  AND EXISTS (SELECT 1 FROM yj_field f WHERE f.label = s.ref_key)
  AND NOT EXISTS (SELECT 1 FROM yj_translation f WHERE f.scope='field' AND f.locale=s.locale AND f.ref_key=s.ref_key);

INSERT INTO yj_translation (scope, ref_key, locale, text, source, created_at, updated_at)
SELECT DISTINCT 'panel', s.ref_key, s.locale, s.text, 'mt', SYSDATETIME(), SYSDATETIME()
FROM yj_translation s
WHERE s.scope IN ('ui','field') AND s.locale IN ('en','ja','ko','de','es','fr','ru','th','vi','zh-TW')
  AND EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_name = s.ref_key)
  AND NOT EXISTS (SELECT 1 FROM yj_translation f WHERE f.scope='panel' AND f.locale=s.locale AND f.ref_key=s.ref_key);

SELECT locale,
       SUM(CASE WHEN scope='field' THEN 1 ELSE 0 END) AS field_rows,
       SUM(CASE WHEN scope='panel' THEN 1 ELSE 0 END) AS panel_rows
FROM yj_translation
WHERE locale IN ('en','ja','ko','de','es','fr','ru','th','vi')
GROUP BY locale ORDER BY locale;