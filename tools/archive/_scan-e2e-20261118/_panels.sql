SET NOCOUNT ON;
SELECT panel_code, panel_name, module_group FROM yj_panel WHERE module_group LIKE N'%手机%' OR panel_code LIKE N'MOBILE%' ORDER BY module_group, panel_code;
