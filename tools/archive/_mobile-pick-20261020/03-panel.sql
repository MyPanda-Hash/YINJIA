SET NOCOUNT ON;
SELECT panel_code, panel_name, head_table, line_table FROM dbo.yj_panel
 WHERE head_table IN (N'bs_wh_loc') OR line_table IN (N'bs_wh_loc') OR panel_name LIKE N'%仓位%';
