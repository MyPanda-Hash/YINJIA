SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='yj_translation' ORDER BY ORDINAL_POSITION;
GO
SELECT t.locale,
       SUM(CASE WHEN t.scope='field' AND e.ref_key IS NOT NULL THEN 1 ELSE 0 END) AS field_hit,
       SUM(CASE WHEN t.scope='panel' AND p.ref_key IS NOT NULL THEN 1 ELSE 0 END) AS panel_hit
FROM yj_translation t
LEFT JOIN (SELECT DISTINCT ref_key FROM yj_translation WHERE locale='en' AND scope='field') e ON e.ref_key = t.ref_key
LEFT JOIN (SELECT DISTINCT ref_key FROM yj_translation WHERE locale='en' AND scope='panel') p ON p.ref_key = t.ref_key
WHERE t.locale IN ('ja','ko','de','es','fr','ru','th','vi')
GROUP BY t.locale ORDER BY t.locale;
GO
