SET NOCOUNT ON;
PRINT '=== 我的 6 个面板是否缺 en 译名(应为 0 行) ===';
SELECT p.panel_code, p.panel_name
FROM yj_panel p
WHERE p.panel_code IN ('TRANSFER','TRANSFER_DETAIL','TRANSFER_STATS','STOCKTAKE','STOCKTAKE_DETAIL','STOCKTAKE_STATS')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
PRINT '=== 我这两个单据面板用到的标签里缺 en 的(应为 0 行) ===';
SELECT DISTINCT f.label
FROM yj_field f
WHERE f.panel_code IN ('TRANSFER','TRANSFER_DETAIL','TRANSFER_STATS','STOCKTAKE','STOCKTAKE_DETAIL','STOCKTAKE_STATS')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en')
  AND NOT EXISTS (SELECT 1 FROM yj_field g WHERE g.label=f.label AND g.label_en IS NOT NULL AND g.label_en<>'');
PRINT '=== 体检 09 报缺的面板名单(18 个) ===';
SELECT p.panel_code, p.panel_name FROM yj_panel p
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en')
ORDER BY p.panel_code;
