SET NOCOUNT ON;
SELECT TOP 5 * FROM report_column_settings;
SELECT name FROM sys.tables WHERE name='report_column_settings';
SELECT TOP 5 panel_code, perms FROM yj_role_panel WHERE panel_code='ORDER_CONVERT';
