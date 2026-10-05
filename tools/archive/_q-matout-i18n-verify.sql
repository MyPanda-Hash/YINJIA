SET NOCOUNT ON;
SELECT
  (SELECT COUNT(DISTINCT col_name) FROM yj_field WHERE panel_code='MATERIAL_OUT') AS 标签数,
  (SELECT COUNT(*) FROM (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT') f
     WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.col_name AND t.locale='ja')) AS 缺ja,
  (SELECT COUNT(*) FROM (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT') f
     WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.col_name AND t.locale='en')) AS 缺en,
  (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND locale='ja' AND source='manual'
     AND ref_key IN (SELECT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT')) AS ja人工译名;
GO
