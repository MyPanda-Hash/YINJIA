SET NOCOUNT ON;
PRINT N'=== 1. yj_panel module_group=研发管理 ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel
WHERE module_group LIKE N'%研发%' OR panel_code LIKE 'RD%' OR panel_code LIKE 'rd%'
ORDER BY panel_code;
GO
PRINT N'=== 2. 所有面板的 module_group 取值分布 ===';
SELECT module_group, COUNT(*) AS cnt FROM yj_panel GROUP BY module_group ORDER BY cnt DESC;
GO
PRINT N'=== 3. 名字含受控/规格书/工艺/检验/测试/履历/变更/定级/进度/公差 的面板 ===';
SELECT panel_code, panel_name, module_group, mode, head_table, line_table
FROM yj_panel
WHERE panel_name LIKE N'%受控%' OR panel_name LIKE N'%规格书%' OR panel_name LIKE N'%工艺%'
   OR panel_name LIKE N'%检验%' OR panel_name LIKE N'%测试%' OR panel_name LIKE N'%履历%'
   OR panel_name LIKE N'%变更%' OR panel_name LIKE N'%定级%' OR panel_name LIKE N'%进度%'
   OR panel_name LIKE N'%公差%' OR panel_name LIKE N'%产品信息%' OR panel_name LIKE N'%项目%'
ORDER BY module_group, panel_code;
