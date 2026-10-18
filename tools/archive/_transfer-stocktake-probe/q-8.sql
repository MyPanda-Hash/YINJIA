SET NOCOUNT ON;
SELECT c.name, c.system_type_id, c.user_type_id, c.max_length, c.is_computed, t.name AS typname
FROM sys.columns c LEFT JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_panel') AND c.name LIKE '%perm%';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en
FROM yj_panel WHERE panel_code IN ('OTHER_IN','OTHER_OUT','STOCK_DETAIL');
