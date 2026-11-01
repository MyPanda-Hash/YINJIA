SET NOCOUNT ON;
SELECT panel_code,panel_name,head_table,line_table FROM yj_panel WHERE panel_code='EMP';
GO
SELECT t.name FROM sys.tables t WHERE t.name LIKE '%emp%' ORDER BY t.name;
GO
