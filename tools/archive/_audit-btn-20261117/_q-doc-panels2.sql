SET NOCOUNT ON;
SELECT panel_code FROM yj_panel WHERE mode = 'doc' AND panel_code >= 'RD_FILTER_EFF' ORDER BY panel_code;
