-- _q_rail_so_probe.sql — 探针:销售订单左栏「单据选择」前置条件核对(面板翻译/头字段键/样例行)
SET NOCOUNT ON;

PRINT '── 1) SO_ORDER 头字段(yj_field place含header)──';
SELECT col_name, data_type, place, seq, hidden, visible
FROM yj_field WHERE panel_code='SO_ORDER' AND place LIKE '%header%'
ORDER BY seq;
GO

PRINT '── 2) 面板名译名 yj_translation scope=panel 销售订单 ──';
SELECT locale, text, source FROM yj_translation WHERE scope='panel' AND ref_key=N'销售订单' ORDER BY locale;
GO

PRINT '── 3) 客户/部门 字段译名 ──';
SELECT ref_key, locale, text, source FROM yj_translation
WHERE scope='field' AND ref_key IN (N'客户', N'部门') ORDER BY ref_key, locale;
GO

PRINT '── 4) bd_so_order 是否有 客户/部门 列 ──';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='bd_so_order' AND COLUMN_NAME IN (N'客户', N'部门', N'业务员', N'单据状态', N'单据编号', N'单据日期');
GO

PRINT '── 5) 样例行:最近5张销售订单(头表口径) ──';
SELECT TOP 5 单据编号, 单据日期, 客户, 部门, 业务员, asp_cancel
FROM bd_so_order WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY asp_time1 DESC;
GO

PRINT '── 6) 相关面板 doc 模式核对 ──';
SELECT panel_code, panel_name, mode, head_table, line_table FROM yj_panel
WHERE panel_code IN ('SO_ORDER','PU_ORDER','SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','SALE_OUT');
GO
