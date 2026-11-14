SET NOCOUNT ON;
PRINT N'=== A. flat 面板清单 ===';
SELECT panel_code, panel_name, mode, category, page_size, module_group, config FROM yj_panel WHERE mode = N'flat' ORDER BY module_group, panel_code;
PRINT N'=== B. mode=doc 且 category=报表 的样例 ===';
SELECT TOP 5 panel_code, panel_name, mode, category, page_size FROM yj_panel WHERE category = N'报表';
