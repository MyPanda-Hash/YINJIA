SET NOCOUNT ON;
PRINT '=== bs_wh_loc 结构 ===';
SELECT c.name, t.name AS typ, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh_loc') ORDER BY c.column_id;
PRINT '=== WHLOC 面板字段 ===';
SELECT seq, label, data_type, ref_panel, ref_field, display_field, ref_filter, place, visible, hidden FROM yj_field WHERE panel_code='WHLOC' ORDER BY seq;
PRINT '=== 采购入库单的仓位字段 ===';
SELECT seq, label, col_name, data_type, ref_panel, ref_field, display_field, ref_filter, place, visible, hidden FROM yj_field WHERE panel_code='PURCHASE_IN' AND (label LIKE N'%仓位%' OR label LIKE N'%库位%') ORDER BY seq;
PRINT '=== 盘点/调拨现有字段里有无仓位 ===';
SELECT panel_code, label FROM yj_field WHERE panel_code IN ('TRANSFER','STOCKTAKE') AND (label LIKE N'%仓位%' OR label LIKE N'%库位%');
