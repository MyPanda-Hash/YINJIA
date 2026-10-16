SET NOCOUNT ON;
SELECT panel_code, panel_name FROM dbo.yj_panel WHERE panel_name LIKE N'%不良%' OR panel_name LIKE N'%隔离%' OR panel_name LIKE N'%报废%' ORDER BY panel_code;
