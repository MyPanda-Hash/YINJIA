SET NOCOUNT ON;
SELECT N'--- INV 面板表 ---' AS s;
SELECT panel_code, panel_name, mode, line_table, head_table FROM yj_panel WHERE panel_code = 'INV';
