SELECT panel_code, panel_name, module_group, category FROM yj_panel WHERE panel_code IN ('QC_TC_IN','PU_ORDER') ORDER BY panel_code
GO
SELECT COUNT(*) AS yj_panel总数 FROM yj_panel
GO
SELECT TOP 10 panel_code, panel_name, module_group FROM yj_panel WHERE panel_code LIKE 'BAK%' OR panel_name LIKE N'%备份%' ORDER BY panel_code
