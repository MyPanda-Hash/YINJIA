SET NOCOUNT ON;
SELECT prefix, COUNT(*) n, MIN(panel_code) sample FROM yj_panel WHERE prefix IS NOT NULL GROUP BY prefix ORDER BY prefix;
