SET NOCOUNT ON;
PRINT '=== MES 盘点单 表头字段 ===';
SELECT label, col_name, data_type, place, visible, hidden FROM yj_field WHERE panel_code='STOCKTAKE' AND place LIKE '%header%' AND label NOT LIKE N'附件%' ORDER BY seq;
PRINT '=== MES 盘点单 明细字段 ===';
SELECT label, col_name, data_type, ref_panel, place, visible, hidden FROM yj_field WHERE panel_code='STOCKTAKE' AND place LIKE '%detail%' ORDER BY seq;
