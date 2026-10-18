SELECT panel_code, panel_name, mode, line_table, head_table, detail_key, ISNULL(config,N'') AS config
FROM dbo.yj_panel WHERE panel_code IN ('WO_REPORT','WO_REPORT_LIST','WO_LIST');
