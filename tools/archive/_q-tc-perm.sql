SET NOCOUNT ON;
PRINT '=== yj_role_panel 列 ===';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_role_panel') ORDER BY column_id;
GO
PRINT '=== QC_TC 权限行 ===';
SELECT * FROM yj_role_panel WHERE panel_code='QC_TC';
GO
PRINT '=== 最终处理结果 / 严重程度 字段 ===';
SELECT col_name, data_type, dict_sql FROM yj_field WHERE panel_code='QC_TC' AND col_name IN (N'最终处理结果', N'严重程度');
GO
