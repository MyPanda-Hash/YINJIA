/* migrate-formno-pool-sync-20261019.sql 自检报「重号 5 个」—— 看看是哪 5 个、什么情况 */
SELECT TOP 20 单据编号, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废
FROM sl_recv GROUP BY 单据编号 HAVING COUNT(*) > 1 ORDER BY 单据编号 DESC
GO
SELECT TOP 20 单据编号, COUNT(*) AS 行数, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废
FROM qc_insp GROUP BY 单据编号 HAVING COUNT(*) > 1 ORDER BY 单据编号 DESC
GO
/* 空白占位头行(全字段空) */
SELECT TOP 10 'sl_recv' AS 表, id, 单据编号, 单据日期, ISNULL(供应商,N'') AS 供应商
FROM sl_recv WHERE ISNULL(供应商,N'')=N'' AND ISNULL(供应商代码,N'')=N'' AND ISNULL(备注,N'')=N''
ORDER BY id DESC
