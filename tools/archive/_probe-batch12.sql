SET NOCOUNT ON;
GO
PRINT '=== 探针造出来的单据在 yj_doc_status 里的状态(应为 canceled/deleting=Y = 已软删) ===';
SELECT s.panel_code, s.doc_no, ISNULL(s.canceled,'N') AS canceled, ISNULL(s.deleting,'N') AS deleting
FROM yj_doc_status s
WHERE s.doc_no LIKE N'SL-2026-10-%' OR s.doc_no LIKE N'IJ-2026-10-%' OR s.doc_no LIKE N'PI-2026-10-%'
ORDER BY s.panel_code, s.doc_no;
GO
PRINT '=== 未软删的(应只有已清理过的 SL-2026-10-0001) ===';
SELECT s.panel_code, s.doc_no, ISNULL(s.canceled,'N') AS canceled, ISNULL(s.deleting,'N') AS deleting
FROM yj_doc_status s
WHERE (s.doc_no LIKE N'SL-2026-10-%' OR s.doc_no LIKE N'IJ-2026-10-%' OR s.doc_no LIKE N'PI-2026-10-%')
  AND ISNULL(s.canceled,'N') <> 'Y' AND ISNULL(s.deleting,'N') <> 'Y';
GO
