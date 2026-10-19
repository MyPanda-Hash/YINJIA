SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, prefix FROM yj_panel WHERE mode='doc' AND (prefix IS NULL OR prefix='');
