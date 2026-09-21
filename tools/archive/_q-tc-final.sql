SET NOCOUNT ON;
PRINT '=== QC_TC.最终处理结果 字段行现状 ===';
SELECT seq, col_name, label, data_type, dict_sql, place, visible
FROM yj_field WHERE panel_code='QC_TC' AND col_name=N'最终处理结果';
GO
PRINT '=== 其它面板 同名/同类 三值字典范例 ===';
SELECT panel_code, col_name, dict_sql FROM yj_field
WHERE col_name IN (N'最终处理结果', N'处理结果') ORDER BY panel_code;
GO
