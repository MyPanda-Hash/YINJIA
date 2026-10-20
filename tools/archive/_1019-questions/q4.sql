SELECT name FROM sys.objects WHERE type='U' AND name LIKE 'yj_%' ORDER BY name
GO
SELECT TOP 40 * FROM yj_panel WHERE panel_code='QC_TC_IN'
GO
SELECT TOP 200 panel_code, panel_name, module_group, category FROM yj_panel ORDER BY module_group, category, panel_code
