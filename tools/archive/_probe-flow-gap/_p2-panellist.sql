SET NOCOUNT ON;
PRINT '=== 生产/品质/新生产/生产管理/委外加工 面板 ===';
SELECT panel_code, panel_name, module_group, mode, head_table, line_table, category
FROM yj_panel
WHERE module_group IN (N'生产制造', N'品质管理', N'新生产', N'生产管理', N'委外加工', N'库存核算', N'订单管理')
ORDER BY module_group, panel_code;
GO
PRINT '=== 全部面板(简) ===';
SELECT panel_code, panel_name, module_group, mode FROM yj_panel ORDER BY module_group, panel_code;
GO
