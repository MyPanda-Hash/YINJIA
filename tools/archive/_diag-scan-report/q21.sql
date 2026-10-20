SELECT panel_code, panel_name, mode, head_table, line_table, page_size, ISNULL(config,N'') AS cfg
FROM dbo.yj_panel WHERE panel_code IN ('INV','WHLOC');
