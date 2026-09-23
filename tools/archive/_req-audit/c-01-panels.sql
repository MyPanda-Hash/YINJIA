SET NOCOUNT ON;
-- C 板块相关模块下面板全清单
SELECT module_group, category, panel_code, panel_name, mode, line_table, head_table,
       group_col, pk_col, code_col, prefix, date_col, detail_key
FROM yj_panel
WHERE module_group IN (N'采购管理', N'仓库管理', N'智能供应链', N'品质管理', N'库存核算', N'订单管理')
ORDER BY module_group, panel_code;
GO
SELECT module_group, COUNT(*) AS cnt
FROM yj_panel
GROUP BY module_group
ORDER BY module_group;
GO
