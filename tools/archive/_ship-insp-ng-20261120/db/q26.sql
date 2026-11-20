SET NOCOUNT ON;
SELECT p.panel_code, p.panel_name FROM yj_panel p
WHERE p.panel_code IN ('QC_PROC_INSP','QC_ASM_INSP')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
SELECT COUNT(*) AS panels_missing_en FROM yj_panel p
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key=p.panel_name AND t.locale='en');
