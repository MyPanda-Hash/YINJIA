SET NOCOUNT ON;
SELECT DISTINCT p.panel_name AS missing FROM yj_panel p
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.locale='en' AND t.ref_key=p.panel_name);
SELECT DISTINCT f.label AS missing_label FROM yj_field f
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.locale='en' AND t.ref_key=f.label);
