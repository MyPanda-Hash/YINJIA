-- r-07:面板编码存在性 + 附件列位 + 采购单两版报表所需字段
SET NOCOUNT ON;
GO
PRINT '=== [1] SL_RECV 是否还存在(registry sl_recv.panelCode 指向它) ===';
SELECT panel_code, panel_name, module_group FROM yj_panel WHERE panel_code IN ('SL_RECV','QC_RECV');
GO
PRINT '=== [2] 附件类字段(data_type=附件)注册在哪些面板 ===';
SELECT panel_code, col_name, label, data_type, place, visible
FROM yj_field WHERE data_type = N'附件' OR label LIKE N'附件%'
ORDER BY panel_code, col_name;
GO
PRINT '=== [3] PU_ORDER 全部字段(采购订单:单头+行) ===';
SELECT col_name, label, data_type, place, visible, hidden, editable
FROM yj_field WHERE panel_code = 'PU_ORDER' ORDER BY place, seq;
GO
PRINT '=== [4] CGD 采购单全部字段(另一张候选「采购单」) ===';
SELECT col_name, label, data_type, place, visible, hidden, editable
FROM yj_field WHERE panel_code = 'CGD' ORDER BY place, seq;
GO
