/* 无结转行的「9 月」批号:这些单据是不是月结**之后**才补录进来的?(月结时间 2026-10-18) */
SELECT 'inh' AS 表, 单据编号, 单据类型, 单据日期, ISNULL(批号,N'(空)') AS 批号, 数量,
       CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间, ISNULL(asp_user1,N'') AS 写入人
FROM inh
WHERE 物料编码 = N'YJ-SX-003-2' AND 仓库编码 = N'YCL-01' AND ISNULL(asp_cancel,'N') <> 'Y'
  AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
ORDER BY asp_time1
GO
SELECT 'outh' AS 表, 单据编号, 单据类型, 单据日期, ISNULL(批号,N'(空)') AS 批号, 数量,
       CONVERT(nvarchar(19), asp_time1, 120) AS 写入时间, ISNULL(asp_user1,N'') AS 写入人
FROM outh
WHERE 物料编码 = N'YJ-SX-003-2' AND 仓库编码 = N'YCL-01' AND ISNULL(asp_cancel,'N') <> 'Y'
  AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
ORDER BY asp_time1
GO
SELECT 期间, 状态, CONVERT(nvarchar(19), 月结时间, 120) AS 月结时间, 行数 FROM bd_stock_close
GO
/* 全库:九月期间有流水、但该 (物料,仓库,批号) 没有结转行的行数 —— 看看这类"看不到结转"的数据有多少 */
SELECT COUNT(*) AS 无结转行的九月流水行数,
       COUNT(DISTINCT CONCAT(物料编码,'|',仓库编码,'|',ISNULL(批号,''))) AS 涉及批号数
FROM (
  SELECT 物料编码, 仓库编码, 批号 FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
     AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
  UNION ALL
  SELECT 物料编码, 仓库编码, 批号 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
     AND 单据日期 >= '2026-09-01' AND 单据日期 < '2026-10-01'
) t
WHERE NOT EXISTS (SELECT 1 FROM inh c WHERE c.单据类型 = N'月结结转' AND ISNULL(c.asp_cancel,'N') <> 'Y'
   AND ISNULL(RTRIM(c.物料编码),N'') = ISNULL(RTRIM(t.物料编码),N'') AND ISNULL(RTRIM(c.仓库编码),N'') = ISNULL(RTRIM(t.仓库编码),N'')
   AND ISNULL(RTRIM(c.批号),N'') = ISNULL(RTRIM(t.批号),N''))
