SET NOCOUNT ON;
SELECT '=== 入库明细 产品编码/产品名称 样例 ===' AS s;
SELECT TOP 12 l.单据编号, RTRIM(LTRIM(l.产品编码)) AS 产品编码, l.产品名称,
       CASE WHEN EXISTS (SELECT 1 FROM dbo.plang p WHERE RTRIM(LTRIM(p.dm)) = RTRIM(LTRIM(l.产品编码))) THEN N'编码对得上工单'
            WHEN EXISTS (SELECT 1 FROM dbo.plang p WHERE RTRIM(LTRIM(p.mc)) = RTRIM(LTRIM(l.产品名称))) THEN N'只有名称对得上工单'
            ELSE N'都对不上' END AS 判定
  FROM dbo.bl_finish_in l
 WHERE l.单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'')
 ORDER BY l.id DESC;
GO
SELECT '=== 按"编码 或 名称"匹配后：待补单据的分档 ===' AS s;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
IF OBJECT_ID('tempdb..#deg') IS NOT NULL DROP TABLE #deg;
CREATE TABLE #r (单据编号 nvarchar(400) PRIMARY KEY, 单据日期 date, 产品数 int);
INSERT INTO #r
SELECT h.单据编号, CAST(h.单据日期 AS date), COUNT(DISTINCT RTRIM(LTRIM(l.产品编码)))
  FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY h.单据编号, CAST(h.单据日期 AS date);

SELECT r.单据编号,
       CASE
         WHEN EXISTS (SELECT 1 FROM dbo.plang p
                       WHERE CAST(p.pl_date AS date) <= r.单据日期
                         AND CAST(p.pl_date AS date) >= DATEADD(day, -180, r.单据日期)
                         AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l WHERE l.单据编号 = r.单据编号
                                      AND (RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm))
                                        OR RTRIM(LTRIM(l.产品名称)) = RTRIM(LTRIM(p.mc)))))
              THEN N'M2 时间窗内对得上'
         WHEN EXISTS (SELECT 1 FROM dbo.plang p
                       WHERE EXISTS (SELECT 1 FROM dbo.bl_finish_in l WHERE l.单据编号 = r.单据编号
                                      AND (RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm))
                                        OR RTRIM(LTRIM(l.产品名称)) = RTRIM(LTRIM(p.mc)))))
              THEN N'M4 对得上但工单晚于入库日'
         ELSE N'M5 产品完全对不上' END AS 档
  INTO #deg
  FROM #r r;

SELECT 档, COUNT(*) AS 单数 FROM #deg GROUP BY 档 ORDER BY 档;
GO
SELECT '=== 覆盖率：M2 里有多少是"全覆盖" ===' AS s;
SELECT COUNT(*) AS M2单数,
       SUM(CASE WHEN 全覆盖 = 1 THEN 1 ELSE 0 END) AS 其中全覆盖,
       SUM(CASE WHEN 全覆盖 = 0 THEN 1 ELSE 0 END) AS 其中部分覆盖
  FROM (
    SELECT r.单据编号,
           CASE WHEN EXISTS (
             SELECT 1 FROM dbo.plang p
              WHERE CAST(p.pl_date AS date) <= r.单据日期
                AND CAST(p.pl_date AS date) >= DATEADD(day, -180, r.单据日期)
                AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l WHERE l.单据编号 = r.单据编号
                             AND (RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm))
                               OR RTRIM(LTRIM(l.产品名称)) = RTRIM(LTRIM(p.mc))))
              GROUP BY p.pl_no
             HAVING COUNT(DISTINCT RTRIM(LTRIM(p.dm))) = r.产品数) THEN 1 ELSE 0 END AS 全覆盖
      FROM #r r
     WHERE EXISTS (SELECT 1 FROM #deg d WHERE d.单据编号 = r.单据编号 AND d.档 = N'M2 时间窗内对得上')
  ) t;
