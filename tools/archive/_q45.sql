SET NOCOUNT ON;
-- 看现有平表报表面板的结构(参照 PURCHASE_IN_DETAIL)
SELECT panel_code, panel_name, mode, head_table, line_table, group_col FROM yj_panel WHERE panel_code IN ('PURCHASE_IN_DETAIL','SALE_OUT_DETAIL');
-- 看一个视图的结构
SELECT c.name, t.name AS type FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID('dbo.v_purchase_in_detail') ORDER BY c.column_id;
-- 看入库/出库行的数量/金额列名
SELECT t.name, c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id WHERE t.name IN ('bl_purchase_in','bl_sale_out','bl_finish_in','bl_other_in','bl_material_out','bl_other_out') AND (c.name LIKE N'%数量%' OR c.name LIKE N'%金额%' OR c.name LIKE N'%存货%' OR c.name LIKE N'%仓库%' OR c.name LIKE N'%规格%') ORDER BY t.name, c.column_id;
