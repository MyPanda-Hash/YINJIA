SET NOCOUNT ON;
WITH l AS (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' AND seq>=270),
m AS (SELECT l.col_name, ROW_NUMBER() OVER (ORDER BY l.col_name) AS rn FROM l
      WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='ja'))
SELECT rn, col_name FROM m WHERE rn > 44 ORDER BY rn;
GO
WITH l AS (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' AND seq>=270)
SELECT l.col_name, t.text FROM l JOIN yj_translation t ON t.scope='field' AND t.ref_key=l.col_name AND t.locale='ja' ORDER BY l.col_name;
GO
