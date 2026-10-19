SET NOCOUNT ON;
PRINT N'== STOCK_STATUS 面板字段 ==';
SELECT col_name, label, data_type, place, seq, width, visible, hidden, ref_panel, ref_field
FROM yj_field WHERE panel_code='STOCK_STATUS' ORDER BY seq;

PRINT N'== STOCK_DETAIL 面板字段 ==';
SELECT col_name, label, data_type, place, seq, visible, hidden
FROM yj_field WHERE panel_code='STOCK_DETAIL' ORDER BY seq;

PRINT N'== STOCK_PICK 面板字段 ==';
SELECT col_name, label, data_type, place, seq, visible, hidden
FROM yj_field WHERE panel_code='STOCK_PICK' ORDER BY seq;

PRINT N'== STOCK_BALANCE 预警数量列是否在面板 ==';
SELECT col_name, label, visible, hidden FROM yj_field WHERE panel_code='STOCK_BALANCE' AND col_name LIKE N'%预警%';
