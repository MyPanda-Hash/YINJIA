/* 只读探针:为「成型工艺清单加修订记录页签」核对现状 */
USE HSDZ_MES;
SET NOCOUNT ON;

PRINT N'== A. RD_MOLD_PROC 字段(place/seq/可见性/字典) ==';
SELECT place, seq, col_name, label, ISNULL(alias, N'') AS alias, data_type, visible, hidden,
       CASE WHEN dict_sql IS NULL THEN N'' ELSE N'<dict>' END AS dict,
       ISNULL(ref_panel, N'') AS ref_panel, ISNULL(ref_field, N'') AS ref_field
FROM yj_field WHERE panel_code = N'RD_MOLD_PROC' ORDER BY place, seq;

PRINT N'== B. RD_ASM_PROC 字段(对照:修订记录相关) ==';
SELECT place, seq, col_name, label, ISNULL(alias, N'') AS alias, data_type, visible, hidden
FROM yj_field WHERE panel_code = N'RD_ASM_PROC' ORDER BY place, seq;

PRINT N'== C. rd_mold_proc_head 列 ==';
SELECT c.name, t.name AS type_name, c.max_length FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('rd_mold_proc_head') ORDER BY c.column_id;

PRINT N'== D. rd_mold_proc_detail 列 ==';
SELECT c.name, t.name AS type_name, c.max_length FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('rd_mold_proc_detail') ORDER BY c.column_id;

PRINT N'== E. rd_asm_proc_detail 列 ==';
SELECT c.name, t.name AS type_name, c.max_length FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('rd_asm_proc_detail') ORDER BY c.column_id;

PRINT N'== F. 行数/表区分布 ==';
SELECT N'rd_mold_proc_detail' AS tbl, ISNULL(表区, N'(null)') AS 表区, COUNT(*) AS n
FROM rd_mold_proc_detail GROUP BY 表区
UNION ALL
SELECT N'rd_asm_proc_detail', ISNULL(表区, N'(null)'), COUNT(*)
FROM rd_asm_proc_detail GROUP BY 表区;
GO
