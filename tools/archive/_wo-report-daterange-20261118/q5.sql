SET NOCOUNT ON;
SELECT p.panel_code, p.panel_name, p.config, f.label, f.data_type, f.place, f.seq
FROM yj_panel p JOIN yj_field f ON f.panel_code=p.panel_code
WHERE p.category=N'报表' AND f.data_type=N'日期' AND f.place LIKE '%query%'
ORDER BY p.panel_code, f.seq;
GO
SELECT panel_code, panel_name, mode, category, config FROM yj_panel WHERE category=N'报表' ORDER BY panel_code;
GO
