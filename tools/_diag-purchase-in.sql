USE HSDZ_MES;
SET NOCOUNT ON;
-- 1. 哪个面板在用这个视图
SELECT panel_code, panel_name, mode, line_table FROM yj_panel WHERE line_table = 'v_purchase_in_detail';
-- 2. 该面板的字段定义(元数据认为有哪些列)
SELECT col_name, label FROM yj_field WHERE panel_code = (SELECT TOP 1 panel_code FROM yj_panel WHERE line_table = 'v_purchase_in_detail') ORDER BY seq;
-- 3. 视图实际拥有的列
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('v_purchase_in_detail') ORDER BY column_id;
