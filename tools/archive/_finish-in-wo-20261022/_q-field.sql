SET NOCOUNT ON;
SELECT col_name, label, place, seq, visible, hidden FROM dbo.yj_field
 WHERE panel_code = N'FINISH_IN' AND (label LIKE N'%加工单%' OR col_name LIKE N'%加工单%' OR label LIKE N'%工单%');
SELECT panel_code, panel_name, mode, line_table, head_table, group_col FROM dbo.yj_panel WHERE panel_code=N'FINISH_IN';
