SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, prefix FROM yj_panel WHERE panel_code='ROUTE';
SELECT id, 工艺路线编码, asp_user1, asp_time1 FROM bs_route WHERE 工艺路线编码 LIKE 'GY-2026-10-%' ORDER BY 工艺路线编码, id;
