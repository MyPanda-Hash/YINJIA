SET NOCOUNT ON;
GO
PRINT N'=== [S1-5] yj_panel 列 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='yj_panel' ORDER BY ORDINAL_POSITION;
GO
PRINT N'=== [S1-6] yj_panel 面板名含 受控/汇总/变更/公差/履历/规范 (复核) ===';
SELECT panel_code, panel_name, panel_name_en FROM yj_panel
WHERE panel_name LIKE N'%受控%' OR panel_name LIKE N'%汇总%' OR panel_name LIKE N'%变更%'
   OR panel_name LIKE N'%公差%' OR panel_name LIKE N'%履历%' OR panel_name LIKE N'%规范%'
   OR panel_name LIKE N'%文件%' OR panel_name LIKE N'%编码%' OR panel_name LIKE N'%规格%'
ORDER BY panel_code;
GO
PRINT N'=== [S1-7] RD_ 面板全清单(22 复核) ===';
SELECT panel_code, panel_name, category, mode, module_group, line_table, head_table FROM yj_panel
WHERE panel_code LIKE 'RD%' ORDER BY panel_code;
GO
PRINT N'=== [S1-8] yj_field 标签含 受控/履历/文件编码/编码/审核 ===';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE label LIKE N'%受控%' OR label LIKE N'%履历%' OR label LIKE N'%文件编码%'
   OR label LIKE N'%编码%' OR label LIKE N'%审核%' OR label LIKE N'%版本%' OR label LIKE N'%修订%'
ORDER BY panel_code, seq;
GO
PRINT N'=== [S1-9] RD_ 面板中 label 含 状态 的字段与 dict_sql ===';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE panel_code LIKE 'RD%' AND (label LIKE N'%状态%' OR col_name LIKE N'%status%')
ORDER BY panel_code, seq;
GO
