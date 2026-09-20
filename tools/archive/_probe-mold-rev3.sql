/* 只读探针 3:成型/组装行表数据现状 + 样例单号 */
USE HSDZ_MES;
SET NOCOUNT ON;

PRINT N'== 1. 行数 ==';
SELECT N'rd_mold_proc_head' AS t, COUNT(*) AS n FROM rd_mold_proc_head
UNION ALL SELECT N'rd_mold_proc_detail', COUNT(*) FROM rd_mold_proc_detail
UNION ALL SELECT N'rd_asm_proc_head', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'rd_asm_proc_detail', COUNT(*) FROM rd_asm_proc_detail;

PRINT N'== 2. 成型行表 表区 分布 ==';
SELECT ISNULL(表区, N'(null)') AS 表区, COUNT(*) AS n FROM rd_mold_proc_detail GROUP BY 表区;

PRINT N'== 3. 成型:样例单号(有配方行的前 5 张) ==';
SELECT TOP 5 单据编号, COUNT(*) AS 行数 FROM rd_mold_proc_detail GROUP BY 单据编号 ORDER BY 单据编号 DESC;

PRINT N'== 4. 组装:样例单号 ==';
SELECT TOP 5 单据编号, ISNULL(表区, N'(null)') AS 表区, COUNT(*) AS 行数
FROM rd_asm_proc_detail GROUP BY 单据编号, 表区 ORDER BY 单据编号 DESC;

PRINT N'== 5. RD_MOLD_PROC 全部 header 字段(seq 400+) ==';
SELECT seq, col_name, label, data_type, visible, hidden FROM yj_field
WHERE panel_code = N'RD_MOLD_PROC' AND place = N'header' AND seq >= 400 ORDER BY seq;
GO
