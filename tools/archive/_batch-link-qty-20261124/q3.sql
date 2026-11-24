SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, line_table, head_table, prefix FROM yj_panel WHERE panel_name LIKE N'%检验%' OR panel_code LIKE 'QC_%' ORDER BY panel_code;
