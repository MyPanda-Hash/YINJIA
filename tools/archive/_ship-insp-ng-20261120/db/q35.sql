SET NOCOUNT ON;
SELECT COUNT(*) AS HSDZ_MES_TEST_rows FROM yj_menu_node;
SELECT TOP 20 node_code, node_name, parent_code, sort_no, hidden FROM yj_menu_node ORDER BY id;
