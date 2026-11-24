SET NOCOUNT ON;
SELECT panel_code, panel_name, mode FROM yj_panel WHERE panel_name LIKE N'%作废%' OR panel_name LIKE N'%状态%' OR panel_name LIKE N'%删除%' ORDER BY panel_code;
