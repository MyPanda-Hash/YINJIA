-- r-03:config 使用面 + doc 面板全清单(能自动拿到「通用报表」入口的面板)
SET NOCOUNT ON;
GO
PRINT '=== [1] yj_panel.config 非空的面板(报表/按钮挂载可能落在这里) ===';
SELECT panel_code, panel_name, LEN(CONVERT(nvarchar(max), config)) AS config_len
FROM yj_panel WHERE config IS NOT NULL ORDER BY panel_code;
GO
PRINT '=== [2] 模式分布 ===';
SELECT mode, category, COUNT(*) AS cnt FROM yj_panel GROUP BY mode, category ORDER BY mode, category;
GO
PRINT '=== [3] 全部 doc 面板(= 自动获得通用报表入口的面板) ===';
SELECT panel_code, panel_name, module_group, head_table, line_table
FROM yj_panel WHERE mode = 'doc' ORDER BY module_group, panel_code;
GO
PRINT '=== [4] 采购/库存/品质 模块分组下的全部面板 ===';
SELECT panel_code, panel_name, category, mode, module_group
FROM yj_panel
WHERE module_group IN (N'采购管理', N'库存核算', N'智能供应链', N'品质管理', N'仓库管理')
ORDER BY module_group, panel_code;
GO
