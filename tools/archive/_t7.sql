SELECT panel_code, ISNULL(config,N'') AS config FROM yj_panel WHERE config LIKE N'%fixedItems%';
