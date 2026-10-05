-- 探针:材料出库单生成器输入(现有列/面板字段)+ 采购入库 转ERP 惯例对照
SET NOCOUNT ON;
PRINT '###TBLCOLS';
SELECT t.name + '|' + c.name FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bd_material_out','bl_material_out','bd_purchase_in','bl_purchase_in') ORDER BY t.name, c.column_id;
PRINT '###PANELFIELDS';
SELECT panel_code + '|' + col_name FROM yj_field WHERE panel_code IN ('MATERIAL_OUT','PURCHASE_IN') ORDER BY panel_code, seq, col_name;
PRINT '###MATOUT_PANEL_FULL';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible
FROM yj_field WHERE panel_code='MATERIAL_OUT' ORDER BY place, seq;
PRINT '###PI_ERP_COLS';
SELECT 'bd_purchase_in' AS t, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_purchase_in') AND (c.name LIKE N'%ERP%' OR c.name LIKE N'%转%');
SELECT 'bl_purchase_in' AS t, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND (c.name LIKE N'%ERP%' OR c.name LIKE N'%转%');
PRINT '###PI_ERP_FIELDS';
SELECT panel_code, col_name, place, seq, visible, hidden FROM yj_field WHERE panel_code='PURCHASE_IN' AND (col_name LIKE N'%ERP%' OR col_name LIKE N'%转%');
PRINT '###MATOUT_PANEL_ROW';
SELECT panel_code, panel_name, category, mode, head_table, line_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key FROM yj_panel WHERE panel_code='MATERIAL_OUT';
PRINT '###ERP_WRITE_TABLES';
SELECT name FROM sys.tables WHERE name LIKE 'erp%' OR name LIKE '%erp%' ORDER BY name;
GO
