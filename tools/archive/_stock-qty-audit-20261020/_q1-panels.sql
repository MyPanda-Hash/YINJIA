SET NOCOUNT ON;
PRINT N'== 1. 库存相关面板 ==';
SELECT panel_code, panel_name, line_table, head_table, mode, module_group
FROM yj_panel
WHERE panel_code LIKE 'STOCK%' OR panel_name LIKE N'%库存%' OR panel_name LIKE N'%盘点%' OR panel_name LIKE N'%调拨%'
ORDER BY panel_code;
