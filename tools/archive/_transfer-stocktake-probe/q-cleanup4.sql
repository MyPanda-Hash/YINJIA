SET NOCOUNT ON;
DECLARE @nos TABLE (no nvarchar(50) PRIMARY KEY);
INSERT INTO @nos VALUES (N'DB-2026-10-0001'),(N'DB-2026-10-0002'),(N'PD-2026-10-0001'),(N'PD-2026-10-0002');
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @nos);
DELETE FROM yj_usage_log WHERE doc_no IN (SELECT no FROM @nos);
DELETE FROM s_allno WHERE dh IN (SELECT no FROM @nos);
SELECT 's_allno(DB/PD)' AS t, COUNT(*) AS n FROM s_allno WHERE lb IN ('DB','PD')
UNION ALL SELECT 'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN ('TRANSFER','STOCKTAKE');
