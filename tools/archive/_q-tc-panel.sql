-- _q-tc-panel.sql — 查 QC_TC 特采申请单面板现状(注册行/字段/翻译/表)
SET NOCOUNT ON;
PRINT '=== 1. yj_panel QC_TC ===';
SELECT panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, prefix, date_col, module_group
FROM yj_panel WHERE panel_code LIKE 'QC_%' ORDER BY panel_code;
GO
PRINT '=== 2. yj_field QC_TC 字段 ===';
SELECT seq, col_name, label, data_type, place, editable, required, hidden, visible
FROM yj_field WHERE panel_code='QC_TC' ORDER BY seq;
GO
PRINT '=== 3. yj_translation 特采相关 ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key LIKE N'%特采%' ORDER BY scope, ref_key, locale;
GO
PRINT '=== 4. qc_tc 表列 ===';
SELECT c.name, t.name AS type, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id = OBJECT_ID('qc_tc') ORDER BY c.column_id;
GO
