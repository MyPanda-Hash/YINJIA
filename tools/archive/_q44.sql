SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE panel_code='STOCK_STATUS';
SELECT col_name, label, data_type, place FROM yj_field WHERE panel_code='STOCK_STATUS' ORDER BY seq;
SELECT c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
SELECT TOP 3 * FROM kucun;
