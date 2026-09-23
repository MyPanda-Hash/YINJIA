-- r-12:C5 来料检验模板基础库现状(9 大类 × 产品编码)
SET NOCOUNT ON;
GO
PRINT '=== [1] bs_qc_plan 列结构 ===';
SELECT c.column_id, c.name, t.name AS type FROM sys.columns c
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('bs_qc_plan') ORDER BY c.column_id;
GO
PRINT '=== [2] bs_qc_item 列结构 ===';
SELECT c.column_id, c.name, t.name AS type FROM sys.columns c
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('bs_qc_item') ORDER BY c.column_id;
GO
PRINT '=== [3] 检验方案/检验项目 数据量 ===';
SELECT 'bs_qc_plan' AS t, COUNT(*) AS rows FROM bs_qc_plan
UNION ALL SELECT 'bs_qc_item', COUNT(*) FROM bs_qc_item;
GO
PRINT '=== [4] 检验方案样本(看是否有 产品编码/大类 口径) ===';
SELECT TOP 15 * FROM bs_qc_plan;
GO
PRINT '=== [5] 检验项目样本 ===';
SELECT TOP 15 * FROM bs_qc_item;
GO
PRINT '=== [6] QC_INSP 是否有 检验结果 下拉(合格/不合格/特采) ===';
SELECT panel_code, col_name, label, data_type, dict_sql FROM yj_field
WHERE panel_code IN ('QC_INSP','QC_RECV','QC_RETURN') AND data_type=N'下拉框';
GO
