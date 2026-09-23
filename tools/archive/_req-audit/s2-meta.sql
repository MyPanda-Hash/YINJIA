SET NOCOUNT ON;
PRINT N'===== 1. 6个面板 yj_panel 定义 =====';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, panel_name_en
FROM yj_panel
WHERE panel_code IN ('RD_PROD_INFO','RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_ASM_BOM','RD_MOLD_PROC')
ORDER BY panel_code;
GO

SET NOCOUNT ON;
PRINT N'===== 2. RD_PROD_INFO 全字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group
FROM yj_field WHERE panel_code='RD_PROD_INFO' ORDER BY place, seq, col_name;
GO

SET NOCOUNT ON;
PRINT N'===== 3. RD_SPEC_DOC 全字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group
FROM yj_field WHERE panel_code='RD_SPEC_DOC' ORDER BY place, seq, col_name;
GO

SET NOCOUNT ON;
PRINT N'===== 4. RD_ASM_PROC 全字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group
FROM yj_field WHERE panel_code='RD_ASM_PROC' ORDER BY place, seq, col_name;
GO

SET NOCOUNT ON;
PRINT N'===== 5. RD_INSP_PLAN 全字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group
FROM yj_field WHERE panel_code='RD_INSP_PLAN' ORDER BY place, seq, col_name;
GO

SET NOCOUNT ON;
PRINT N'===== 6. RD_ASM_BOM 全字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group
FROM yj_field WHERE panel_code='RD_ASM_BOM' ORDER BY place, seq, col_name;
GO

SET NOCOUNT ON;
PRINT N'===== 7. RD_MOLD_PROC 全字段 =====';
SELECT panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, alias, visible, label_en, col_group
FROM yj_field WHERE panel_code='RD_MOLD_PROC' ORDER BY place, seq, col_name;
GO
