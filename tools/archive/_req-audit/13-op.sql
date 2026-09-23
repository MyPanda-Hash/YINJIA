SET NOCOUNT ON;
PRINT '=== bs_op 工序库 ===';
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_op' ORDER BY ORDINAL_POSITION;
GO
SELECT COUNT(*) AS op_rows FROM bs_op;
GO
SELECT TOP 30 * FROM bs_op;
GO
PRINT '=== 含"工序"的表 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%op%' OR TABLE_NAME LIKE '%proc%' OR TABLE_NAME LIKE '%route%';
GO
PRINT '=== RD_SPEC_DOC 物料清单区 物料编码 是否参照 ===';
SELECT col_name, label, data_type, ref_panel, ref_field, display_field, place FROM yj_field WHERE panel_code='RD_SPEC_DOC' AND (label LIKE N'%物料%' OR label LIKE N'%表区%' OR label LIKE N'%检验%');
GO
PRINT '=== RD_ASM_PROC 工序字段是否参照/下拉 ===';
SELECT col_name, label, data_type, dict_sql, ref_panel, place FROM yj_field WHERE panel_code='RD_ASM_PROC';
GO
PRINT '=== 研发面板 表区/页签 设计(表区字段) ===';
SELECT panel_code, col_name, label, dict_sql FROM yj_field WHERE label=N'表区';
