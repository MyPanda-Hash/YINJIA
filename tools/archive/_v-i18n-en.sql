SET NOCOUNT ON;
PRINT '=== A. 缺 en 的 panel 行(全部) ===';
SELECT p.panel_code, p.panel_name FROM yj_panel p
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en')
ORDER BY p.panel_code;
GO
PRINT '=== B. 本任务新面板相关:QC_TC_IN 的 23 个字段标签是否都有 en ===';
SELECT f.label,
       (SELECT COUNT(*) FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en') AS has_en
FROM yj_field f WHERE f.panel_code='QC_TC_IN' ORDER BY f.seq;
GO
PRINT '=== C. 全库缺 en 的 field 行数(基线对照) ===';
SELECT COUNT(*) AS missing_field_en FROM (
  SELECT f.panel_code, f.label FROM yj_field f
  WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en')
  GROUP BY f.panel_code, f.label) x;
GO
