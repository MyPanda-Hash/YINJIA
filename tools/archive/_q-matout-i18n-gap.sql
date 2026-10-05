SET NOCOUNT ON;
--  MATERIAL_OUT 字段标签的多语言覆盖(en / ja),只看本次新增(seq>=970 或 转ERP 四字段)
WITH l AS (
  SELECT DISTINCT col_name FROM yj_field
  WHERE panel_code='MATERIAL_OUT' AND (seq>=270)
)
SELECT
  (SELECT COUNT(*) FROM l) AS 新增标签数,
  (SELECT COUNT(*) FROM l WHERE EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='en')) AS 有en,
  (SELECT COUNT(*) FROM l WHERE EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='ja')) AS 有ja,
  (SELECT COUNT(*) FROM l WHERE EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='zh-TW')) AS 有zhTW;
GO
WITH l AS (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' AND seq>=270)
SELECT l.col_name AS 缺ja标签,
  (SELECT text FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='en') AS en
FROM l
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='ja')
ORDER BY l.col_name;
GO
