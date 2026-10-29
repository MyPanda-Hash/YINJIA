SET NOCOUNT ON;
SELECT '=== 产品编码：入库明细 vs 工单 的匹配(精确/去空格) ===' AS s;
WITH hi AS (SELECT DISTINCT l.产品编码 FROM dbo.bl_finish_in l
             WHERE l.单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'')),
pf AS (SELECT DISTINCT dm FROM dbo.plang)
SELECT (SELECT COUNT(*) FROM hi) AS 入库产品数,
       (SELECT COUNT(*) FROM hi WHERE EXISTS (SELECT 1 FROM pf WHERE pf.dm = hi.产品编码)) AS 精确匹配,
       (SELECT COUNT(*) FROM hi WHERE EXISTS (SELECT 1 FROM pf WHERE RTRIM(LTRIM(pf.dm)) = RTRIM(LTRIM(hi.产品编码)))) AS 去空格匹配,
       (SELECT COUNT(*) FROM hi WHERE EXISTS (SELECT 1 FROM pf WHERE UPPER(RTRIM(LTRIM(pf.dm))) = UPPER(RTRIM(LTRIM(hi.产品编码))))) AS 去空格大写匹配;
GO
SELECT '=== 未匹配产品样例(前 20) ===' AS s;
WITH hi AS (SELECT l.产品编码, COUNT(*) AS 行数 FROM dbo.bl_finish_in l
             WHERE l.单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'')
             GROUP BY l.产品编码)
SELECT TOP 20 hi.产品编码, hi.行数,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.bs_inv i WHERE i.存货编码 = hi.产品编码) THEN N'商品档案有' ELSE N'商品档案无' END AS 档案
  FROM hi
 WHERE NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE RTRIM(LTRIM(p.dm)) = RTRIM(LTRIM(hi.产品编码)))
 ORDER BY hi.行数 DESC;
GO
SELECT '=== 分层结果(全覆盖 / 部分覆盖 / 无候选, 窗口120天, 去空格比较) ===' AS s;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
IF OBJECT_ID('tempdb..#c') IS NOT NULL DROP TABLE #c;
SELECT h.单据编号, CAST(h.单据日期 AS date) AS 单据日期, COUNT(DISTINCT l.产品编码) AS 产品数
  INTO #r
  FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY h.单据编号, CAST(h.单据日期 AS date);
SELECT r.单据编号, r.产品数, p.pl_no AS 工单号,
       COUNT(DISTINCT RTRIM(LTRIM(p.dm))) AS 覆盖产品数,
       MAX(CAST(p.pl_date AS date)) AS 工单日期,
       DATEDIFF(day, MAX(CAST(p.pl_date AS date)), r.单据日期) AS 时间差天
  INTO #c
  FROM #r r
  JOIN dbo.plang p
    ON CAST(p.pl_date AS date) <= r.单据日期
   AND CAST(p.pl_date AS date) >= DATEADD(day, -120, r.单据日期)
   AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l
                WHERE l.单据编号 = r.单据编号 AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm)))
 WHERE ISNULL(p.pl_no, N'') <> N''
 GROUP BY r.单据编号, r.产品数, p.pl_no, r.单据日期;
WITH best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号 ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 工单号 DESC) AS rn
    FROM #c)
SELECT (SELECT COUNT(*) FROM #r) AS 待补,
       SUM(CASE WHEN 覆盖产品数 = 产品数 THEN 1 ELSE 0 END) AS 全覆盖_可填,
       SUM(CASE WHEN 覆盖产品数 < 产品数 THEN 1 ELSE 0 END) AS 部分覆盖_不建议自动填,
       (SELECT COUNT(*) FROM #r WHERE NOT EXISTS (SELECT 1 FROM #c WHERE #c.单据编号 = #r.单据编号)) AS 无候选
  FROM best WHERE rn = 1;
