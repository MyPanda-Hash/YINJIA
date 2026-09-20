/* 只读探针 2:RD_MOLD_PROC 字段全集 + 修订记录列现状 */
USE HSDZ_MES;
SET NOCOUNT ON;

PRINT N'== 1. yj_field 行数(各面板) ==';
SELECT panel_code, COUNT(*) AS n FROM yj_field
WHERE panel_code IN (N'RD_MOLD_PROC', N'RD_MOLD_FORMULA', N'RD_ASM_PROC', N'RD_ASM_BOM')
GROUP BY panel_code;

PRINT N'== 2. RD_MOLD_PROC 中的关键列(表区/配料要求/修订记录列) ==';
SELECT panel_code, place, seq, col_name, label, ISNULL(alias, N'') AS alias, data_type, visible, hidden
FROM yj_field
WHERE panel_code = N'RD_MOLD_PROC'
  AND col_name IN (N'表区', N'配料要求', N'更改内容', N'更改原因', N'更改时间', N'责任人', N'备注', N'日期', N'版本号', N'序号');

PRINT N'== 3. RD_MOLD_PROC 行表的全部 detail 字段 ==';
SELECT place, seq, col_name, label, data_type FROM yj_field
WHERE panel_code = N'RD_MOLD_PROC' AND place = N'detail' ORDER BY seq;

PRINT N'== 4. RD_MOLD_FORMULA(已下线)字段 ==';
SELECT place, seq, col_name, label, data_type FROM yj_field
WHERE panel_code = N'RD_MOLD_FORMULA' ORDER BY place, seq;

PRINT N'== 5. 数据量 ==';
SELECT N'rd_mold_proc_head' AS t, COUNT(*) AS n FROM rd_mold_proc_head
UNION ALL SELECT N'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail
UNION ALL SELECT N'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'rd_asm_proc_detail', COUNT(*) FROM rd_asm_proc_detail
UNION ALL SELECT N'rd_mold_formula_head', COUNT(*) FROM rd_mold_formula_head
UNION ALL SELECT N'rd_mold_formula_detail', COUNT(*) FROM rd_mold_formula_detail;

PRINT N'== 6. rd_mold_proc_detail 的 表区 取值分布 ==';
SELECT ISNULL(表区, N'(null)') AS 表区, COUNT(*) AS n FROM rd_mold_proc_detail GROUP BY 表区;

PRINT N'== 7. 译名:修订记录相关字段 ==';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key IN (N'修订记录', N'更改内容', N'更改原因', N'更改时间', N'责任人', N'备注', N'序号', N'日期', N'版本号')
ORDER BY ref_key, locale;
GO
