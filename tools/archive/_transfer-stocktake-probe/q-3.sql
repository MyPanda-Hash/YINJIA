SET NOCOUNT ON;
PRINT '=== yj_field 列 ===';
SELECT c.name, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
PRINT '=== OTHER_OUT 字段 ===';
SELECT seq, label, data_type, place, width, editable, required, hidden, visible, ref_panel, ref_field, display_field, dict_sql
FROM yj_field WHERE panel_code='OTHER_OUT' ORDER BY seq;
PRINT '=== OTHER_OUT 明细字段 ===';
SELECT seq, label, data_type, place, width, editable, required, hidden, visible, ref_panel, ref_field, display_field
FROM yj_field WHERE panel_code='OTHER_OUT_DETAIL' ORDER BY seq;
