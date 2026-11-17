SET NOCOUNT ON;
SELECT mode, COUNT(*) AS n FROM yj_panel GROUP BY mode ORDER BY mode;
PRINT '---- doc panels ----';
SELECT panel_code, panel_name, category FROM yj_panel WHERE mode = 'doc' ORDER BY panel_code;
