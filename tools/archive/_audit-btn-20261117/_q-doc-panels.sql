SET NOCOUNT ON;
SELECT panel_code + '|' + panel_name FROM yj_panel WHERE mode = 'doc' ORDER BY panel_code;
