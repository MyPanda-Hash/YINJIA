SET NOCOUNT ON;

DECLARE @MaxDays int = 120;   -- 工单日期距入库日不超过 N 天

IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
IF OBJECT_ID('tempdb..#c') IS NOT NULL DROP TABLE #c;

-- 待补入库单 + 产品数
SELECT h.id AS 头id, h.单据编号, CAST(h.单据日期 AS date) AS 单据日期,
       COUNT(DISTINCT l.产品编码) AS 产品数
  INTO #r
  FROM dbo.bd_finish_in h
  JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY h.id, h.单据编号, CAST(h.单据日期 AS date);

-- 候选：工单号 × 入库单 —— 覆盖产品数、工单日期（该工单内最晚一行）
SELECT r.单据编号, r.产品数, p.pl_no AS 工单号,
       COUNT(DISTINCT p.dm) AS 覆盖产品数,
       MAX(CAST(p.pl_date AS date)) AS 工单日期,
       DATEDIFF(day, MAX(CAST(p.pl_date AS date)), r.单据日期) AS 时间差天
  INTO #c
  FROM #r r
  JOIN dbo.plang p
    ON CAST(p.pl_date AS date) <= r.单据日期
   AND CAST(p.pl_date AS date) >= DATEADD(day, -@MaxDays, r.单据日期)
   AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l
                WHERE l.单据编号 = r.单据编号 AND l.产品编码 = p.dm)
 WHERE ISNULL(p.pl_no, N'') <> N''
 GROUP BY r.单据编号, r.产品数, p.pl_no, r.单据日期;

SELECT '=== 覆盖率分布（每单取覆盖产品数最大、时间最近的工单）===' AS s;
WITH best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号
                               ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 工单号 DESC) AS rn
    FROM #c
)
SELECT N'单产品' AS 类别, 覆盖产品数, COUNT(*) AS 单数 FROM best WHERE rn = 1 AND 产品数 = 1 GROUP BY 覆盖产品数
UNION ALL
SELECT N'多产品', 覆盖产品数, COUNT(*) FROM best WHERE rn = 1 AND 产品数 > 1 GROUP BY 覆盖产品数
ORDER BY 类别, 覆盖产品数;
GO
SELECT '=== 汇总 ===' AS s;
WITH best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号
                               ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 工单号 DESC) AS rn
    FROM #c
)
SELECT (SELECT COUNT(*) FROM #r) AS 待补单数,
       SUM(CASE WHEN 覆盖产品数 = 产品数 THEN 1 ELSE 0 END) AS 全覆盖,
       SUM(CASE WHEN 覆盖产品数 < 产品数 THEN 1 ELSE 0 END) AS 部分覆盖,
       (SELECT COUNT(*) FROM #r WHERE NOT EXISTS (SELECT 1 FROM #c WHERE #c.单据编号 = #r.单据编号)) AS 无任何候选
  FROM best WHERE rn = 1;
GO
SELECT '=== 抽查 10 张：入库单 vs 建议工单 ===' AS s;
WITH best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号
                               ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 工单号 DESC) AS rn
    FROM #c
)
SELECT b.单据编号, r.单据日期, b.产品数, b.覆盖产品数, b.工单号, b.工单日期, b.时间差天,
       (SELECT STUFF((SELECT N',' + x.产品编码 FROM (SELECT TOP 3 产品编码 FROM dbo.bl_finish_in l2
          WHERE l2.单据编号 = b.单据编号 ORDER BY 产品编码) x FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 产品前3
  FROM best b JOIN #r r ON r.单据编号 = b.单据编号
 WHERE b.rn = 1
 ORDER BY r.单据日期 DESC, b.单据编号 DESC;
