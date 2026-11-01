/* _prod-pick-mig-20261025/recon2.sql — 只读补证:译名覆盖/角色总数/数据源分布(每结果集 ≤50 行) */
SET NOCOUNT ON;

/* 1) 面板译名(全部 locale) */
SELECT N'1-panel-trans' AS tag, * FROM dbo.yj_translation WHERE scope = 'panel' AND ref_key = N'生产领料';

/* 2) 18 个字段标签的译名覆盖(聚合,≤18 行) */
SELECT N'2-field-cover' AS tag, f.label, f.label_en,
       COUNT(t.id) AS n_locales,
       MAX(CASE WHEN t.locale = 'en' THEN t.text END) AS en_text,
       MAX(CASE WHEN t.locale = 'ja' THEN t.text END) AS ja_text
  FROM dbo.yj_field f
  LEFT JOIN dbo.yj_translation t ON t.scope = 'field' AND t.ref_key = f.label
 WHERE f.panel_code = N'PROD_PICK_LIST'
 GROUP BY f.label, f.label_en
 ORDER BY f.label;

/* 3) 角色总数 vs 已授权数 */
SELECT N'3-roles' AS tag,
       (SELECT COUNT(*) FROM dbo.yj_role) AS total_roles,
       (SELECT COUNT(*) FROM dbo.yj_role_panel WHERE panel_code = N'PROD_PICK_LIST') AS granted_roles;

/* 4) outh src 分布(数据源段) */
SELECT N'4-outh-src' AS tag, src, COUNT(*) AS n FROM dbo.outh GROUP BY src ORDER BY src;

/* 5) 视图行数(健康度) */
SELECT N'5-view-rows' AS tag, COUNT(*) AS n FROM dbo.v_prod_pick_list;
