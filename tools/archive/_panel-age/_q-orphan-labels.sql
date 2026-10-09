SET NOCOUNT ON;
-- _q-orphan-labels.sql — 下架后会变成孤儿的「字段译名」有哪些(只读)
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES
 ('PU_REQ'),('OTHER_IN'),('OTHER_IN_DETAIL'),('OTHER_IN_STATS'),('OTHER_OUT'),('OTHER_OUT_DETAIL'),
 ('OTHER_OUT_STATS'),('OUTSOURCE_IN'),('OUTSOURCE_IN_DETAIL'),('OUTSOURCE_IN_STATS'),
 ('OUTSOURCE_ISSUE'),('OUTSOURCE_ISSUE_DETAIL'),('OUTSOURCE_ISSUE_STATS');
GO
SELECT 'PANEL_NAMES' AS k, panel_name FROM yj_panel WHERE panel_code IN (SELECT code FROM #p) ORDER BY panel_name;
GO
SELECT 'ORPHAN_LABELS' AS k, f.label, COUNT(*) AS 译名条数
FROM yj_field f JOIN #p x ON x.code = f.panel_code
WHERE NOT EXISTS (SELECT 1 FROM yj_field g WHERE g.label = f.label AND g.panel_code NOT IN (SELECT code FROM #p))
  AND EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label)
GROUP BY f.label ORDER BY f.label;
GO
SELECT 'ORPHAN_LABELS_IN_UI_SCOPE' AS k, t.ref_key, t.locale
FROM yj_translation t WHERE t.scope <> 'field'
  AND t.ref_key IN (SELECT f.label FROM yj_field f JOIN #p x ON x.code = f.panel_code
                    WHERE NOT EXISTS (SELECT 1 FROM yj_field g WHERE g.label = f.label AND g.panel_code NOT IN (SELECT code FROM #p)))
ORDER BY t.ref_key, t.locale;
