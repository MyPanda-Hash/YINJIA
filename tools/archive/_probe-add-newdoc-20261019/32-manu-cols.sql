SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('bd_manu_order') ORDER BY c.column_id;
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, pk_col, code_col, prefix, date_col FROM yj_panel WHERE panel_code='MANU_ORDER';
SELECT TOP 5 * FROM bd_manu_order ORDER BY id DESC;
