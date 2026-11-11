SET NOCOUNT ON;
PRINT N'=== A. PURCHASE_IN_DETAIL 全列 ===';
SELECT * FROM yj_panel WHERE panel_code = N'PURCHASE_IN_DETAIL';
PRINT N'=== B. PURCHASE_IN_DETAIL 字段 ===';
SELECT id, col_name, label, data_type, place, seq, width, visible, hidden, alias, col_group, dict_sql, ref_panel, ref_field
FROM yj_field WHERE panel_code = N'PURCHASE_IN_DETAIL' ORDER BY seq, id;
PRINT N'=== C. FINISH_IN_DETAIL 字段(另一只明细表样例) ===';
SELECT id, col_name, label, data_type, place, seq, width, visible, hidden, alias, col_group
FROM yj_field WHERE panel_code = N'FINISH_IN_DETAIL' ORDER BY seq, id;
