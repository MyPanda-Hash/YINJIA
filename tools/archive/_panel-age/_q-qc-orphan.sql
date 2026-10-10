SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES ('QC_OP'),('QC_RECORD'),('QC_DISPOSAL'),('ROD_RETURN'),('LOT_TRACE');
GO
SELECT 'ORPHAN_LABELS' AS k, f.label, COUNT(*) AS 译名条数
FROM yj_field f JOIN #p x ON x.code = f.panel_code
WHERE NOT EXISTS (SELECT 1 FROM yj_field g WHERE g.label = f.label AND g.panel_code NOT IN (SELECT code FROM #p))
  AND EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label)
GROUP BY f.label ORDER BY f.label;
GO
SELECT 'ORPHAN_LABELS_TOTAL' AS k, COUNT(DISTINCT f.label) AS n
FROM yj_field f JOIN #p x ON x.code = f.panel_code
WHERE NOT EXISTS (SELECT 1 FROM yj_field g WHERE g.label = f.label AND g.panel_code NOT IN (SELECT code FROM #p))
  AND EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label);
GO
SELECT 'V_LOT_TRACE 定义' AS k, CAST(m.definition AS nvarchar(max)) AS def FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.v_lot_trace');
