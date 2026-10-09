-- _q-merge-lab-dates-data.sql — 时间区间格的数据实况(只读,测试账套)
SET NOCOUNT ON;
PRINT '=== rd_instr_use 里 起止时间 有值的行 ===';
SELECT TOP 10 id, 单据编号, 使用日期, 起止时间 FROM rd_instr_use_detail
WHERE ISNULL(起止时间, N'') <> N'' ORDER BY id DESC;
PRINT '=== 该列整体情况 ===';
SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(起止时间,N'')<>N'' THEN 1 ELSE 0 END) AS 有值行 FROM rd_instr_use_detail;
PRINT '=== 使用日期最近 5 行(对位探针打开的那张单) ===';
SELECT TOP 5 id, 单据编号, 使用日期, 起止时间 FROM rd_instr_use_detail ORDER BY id DESC;
