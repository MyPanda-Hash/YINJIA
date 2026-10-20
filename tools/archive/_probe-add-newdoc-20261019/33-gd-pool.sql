SET NOCOUNT ON;
SELECT panel_code, panel_name, head_table, line_table, group_col, prefix FROM yj_panel WHERE prefix='GD';
SELECT MAX(dh) max_pool_gd, COUNT(*) n FROM s_allno WHERE lb='GD';
SELECT MAX(pl_no) max_plang, COUNT(*) n FROM plang WHERE pl_no LIKE 'GD-%';
SELECT TOP 5 pl_no FROM plang WHERE pl_no LIKE 'GD-%' ORDER BY pl_no DESC;
SELECT 合同号, COUNT(*) n FROM bd_manu_order GROUP BY 合同号;
SELECT MAX(单据编号) max_wo, COUNT(*) n FROM wo_order;
SELECT panel_code, COUNT(*) n FROM yj_doc_status WHERE panel_code IN ('MANU_ORDER','WO_ORDER') GROUP BY panel_code;
