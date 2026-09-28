SET NOCOUNT ON;
WITH l AS (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' AND seq>=270),
m AS (SELECT l.col_name FROM l WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=l.col_name AND t.locale='ja'))
SELECT STRING_AGG(CAST(col_name AS nvarchar(max)), N' | ') WITHIN GROUP (ORDER BY col_name) AS 缺ja FROM m;
GO
WITH l AS (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' AND seq>=270)
SELECT STRING_AGG(CAST(l.col_name AS nvarchar(max)), N' | ') WITHIN GROUP (ORDER BY l.col_name) AS 全部新增标签 FROM l;
GO
WITH l AS (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT' AND seq>=270)
SELECT l.col_name, t.text FROM l JOIN yj_translation t ON t.scope='field' AND t.ref_key=l.col_name AND t.locale='ja' ORDER BY l.col_name;
GO
