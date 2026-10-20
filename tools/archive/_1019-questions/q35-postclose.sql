/* 月结之后才补录的「9 月单据」(asp_time1 > 月结时间)—— 若有,它们没被结转行包含,不能一起藏掉 */
SELECT 'inh' AS 表, COUNT(*) AS 行数 FROM inh
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
  AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01' AND asp_time1 > '2026-10-18 16:27:16'
UNION ALL
SELECT 'outh', COUNT(*) FROM outh
WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01' AND asp_time1 > '2026-10-18 16:27:16'
GO
SELECT TOP 10 单据编号, 单据类型, 单据日期, ISNULL(批号,N'(空)') AS 批号, 数量, CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间
FROM inh WHERE 单据类型 <> N'月结结转' AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
  AND asp_time1 > '2026-10-18 16:27:16' ORDER BY asp_time1
GO
SELECT TOP 10 单据编号, 单据类型, 单据日期, ISNULL(批号,N'(空)') AS 批号, 数量, CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间
FROM outh WHERE 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
  AND asp_time1 > '2026-10-18 16:27:16' ORDER BY asp_time1
