-- 只读探针:检验类型 字段/译名/下拉框机制现状
SET NOCOUNT ON;

PRINT N'[1] 已有的检验类型字段(各面板)';
SELECT panel_code, col_name, label, alias, data_type, ISNULL(dict_sql,N'') AS dict_sql, place, seq, visible, hidden, editable
FROM yj_field WHERE label = N'检验类型' OR col_name = N'检验类型' ORDER BY panel_code;

PRINT N'[2] 检验类型译名(yj_translation)';
SELECT scope, ref_key, locale, text, source FROM yj_translation WHERE ref_key = N'检验类型' ORDER BY scope, locale;

PRINT N'[3] 下拉框字段的 dict_sql 例子';
SELECT panel_code, col_name, label, data_type, ISNULL(dict_sql,N'') AS dict_sql
FROM yj_field WHERE data_type = N'下拉框' AND dict_sql IS NOT NULL AND panel_code IN (N'QC_ASM_INSP',N'QC_PROC_INSP',N'QC_INSP',N'QC_MOLD_INSP')
ORDER BY panel_code, seq;

PRINT N'[4] yj_panel.config(fixedItems)现状';
SELECT panel_code, ISNULL(config,N'') AS config FROM yj_panel WHERE config LIKE N'%fixedItems%';

PRINT N'[5] QC_ASM_INSP 明细行统计';
SELECT COUNT(*) AS total_rows, SUM(CASE WHEN ISNULL(表区,N'') = N'' THEN 1 ELSE 0 END) AS blank_area
FROM qc_asm_insp_detail WHERE ISNULL(asp_cancel,'N') <> 'Y';

PRINT N'[6] 谁引用了 qc_asm_insp_detail';
SELECT DISTINCT o.name, o.type_desc
FROM sys.sql_expression_dependencies d JOIN sys.objects o ON o.object_id = d.referencing_id
WHERE d.referenced_id = OBJECT_ID(N'qc_asm_insp_detail');

PRINT N'[7] 表头 qc_asm_insp_head 的列';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'qc_asm_insp_head') ORDER BY c.column_id;
