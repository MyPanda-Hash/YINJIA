SET NOCOUNT ON;

IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
SELECT h.单据编号, CAST(h.单据日期 AS date) AS 单据日期, COUNT(DISTINCT l.产品编码) AS 产品数
  INTO #r
  FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY h.单据编号, CAST(h.单据日期 AS date);

SELECT '=== 不同时间窗口下：全覆盖可填单数 ===' AS s;
SELECT CAST(w.d AS nvarchar(10)) AS 窗口天数,
       (SELECT COUNT(*) FROM #r r WHERE EXISTS (
           SELECT 1 FROM dbo.plang p
            WHERE CAST(p.pl_date AS date) <= r.单据日期
              AND CAST(p.pl_date AS date) >= DATEADD(day, -w.d, r.单据日期)
              AND ISNULL(p.pl_no, N'') <> N''
            GROUP BY p.pl_no
           HAVING COUNT(DISTINCT RTRIM(LTRIM(p.dm))) = r.产品数)) AS 全覆盖单数
  FROM (SELECT 30 AS d UNION ALL SELECT 60 UNION ALL SELECT 90 UNION ALL SELECT 120 UNION ALL SELECT 180 UNION ALL SELECT 365) w
 ORDER BY w.d;
GO
SELECT '=== 120 天窗口：31 张全覆盖单的明细(逐单看是否说得通) ===' AS s;
WITH cand AS (
  SELECT r.单据编号, r.单据日期, r.产品数, p.pl_no,
         COUNT(DISTINCT RTRIM(LTRIM(p.dm))) AS 覆盖产品数,
         MAX(CAST(p.pl_date AS date)) AS 工单日期,
         DATEDIFF(day, MAX(CAST(p.pl_date AS date)), r.单据日期) AS 时间差天
    FROM #r r
    JOIN dbo.plang p
      ON CAST(p.pl_date AS date) <= r.单据日期
     AND CAST(p.pl_date AS date) >= DATEADD(day, -120, r.单据日期)
     AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l
                  WHERE l.单据编号 = r.单据编号 AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm)))
   WHERE ISNULL(p.pl_no, N'') <> N''
   GROUP BY r.单据编号, r.单据日期, r.产品数, p.pl_no
), best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号 ORDER BY 时间差天 ASC, pl_no DESC) AS rn
    FROM cand WHERE 覆盖产品数 = 产品数
)
SELECT b.单据编号, b.单据日期, b.产品数, b.pl_no AS 建议工单号, b.工单日期, b.时间差天,
       (SELECT STUFF((SELECT N',' + x.产品编码 FROM (SELECT 产品编码 FROM dbo.bl_finish_in l2
           WHERE l2.单据编号 = b.单据编号 GROUP BY 产品编码) x FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 入库产品,
       (SELECT STUFF((SELECT N',' + x.plx FROM (SELECT CONVERT(nvarchar(10), p2.pl_xc) + N':' + p2.dm AS plx
           FROM dbo.plang p2 WHERE p2.pl_no = b.pl_no) x FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 工单行
  FROM best b WHERE b.rn = 1
 ORDER BY b.时间差天, b.单据日期 DESC;
