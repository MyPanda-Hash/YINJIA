SET NOCOUNT ON;
PRINT '=== MES 调拨单 表头字段(业务相关) ===';
SELECT label, col_name, data_type, place, visible, hidden FROM yj_field WHERE panel_code='TRANSFER' AND place LIKE '%header%' AND label NOT LIKE N'附件%' ORDER BY seq;
PRINT '=== MES 调拨单 明细字段 ===';
SELECT label, col_name, data_type, ref_panel, place, visible, hidden FROM yj_field WHERE panel_code='TRANSFER' AND place LIKE '%detail%' ORDER BY seq;
