SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
CREATE TABLE #r (单据编号 nvarchar(400) PRIMARY KEY, 单据日期 date, 产品数 int);
INSERT INTO #r
SELECT h.单据编号, CAST(h.单据日期 AS date), COUNT(DISTINCT RTRIM(LTRIM(l.产品编码)))
  FROM dbo.bd_finish_in h JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY h.单据编号, CAST(h.单据日期 AS date);

IF OBJECT_ID('tempdb..#deg') IS NOT NULL DROP TABLE #deg;
SELECT r.单据编号, r.单据日期, r.产品数,
       CASE
         WHEN EXISTS (SELECT 1 FROM dbo.plang p
                       WHERE CAST(p.pl_date AS date) <= r.单据日期
                         AND CAST(p.pl_date AS date) >= DATEADD(day, -180, r.单据日期)
                         AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l WHERE l.单据编号 = r.单据编号
                                      AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm))))
              THEN N'M2 时间窗内对得上产品'
         WHEN EXISTS (SELECT 1 FROM dbo.plang p
                       WHERE CAST(p.pl_date AS date) <= r.单据日期
                         AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l WHERE l.单据编号 = r.单据编号
                                      AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm))))
              THEN N'M3 产品对得上但工单早于入库日 180 天以上'
         WHEN EXISTS (SELECT 1 FROM dbo.plang p
                       WHERE EXISTS (SELECT 1 FROM dbo.bl_finish_in l WHERE l.单据编号 = r.单据编号
                                      AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm))))
              THEN N'M4 产品对得上但工单日期晚于入库日'
         ELSE N'M5 产品在 plang 里完全没有' END AS 档
  INTO #deg
  FROM #r r;

SELECT '=== 231 张空单按"能不能对得上产品"分档 ===' AS s;
SELECT 档, COUNT(*) AS 单数 FROM #deg GROUP BY 档 ORDER BY 档;
GO
SELECT '=== 累计：放宽到第几档可以覆盖全部 231 ===' AS s;
SELECT N'只做 M2（=strict/lenient 用的那批）' AS 策略,
       SUM(CASE WHEN 档 = N'M2 时间窗内对得上产品' THEN 1 ELSE 0 END) AS 可补, 231 - SUM(CASE WHEN 档 = N'M2 时间窗内对得上产品' THEN 1 ELSE 0 END) AS 仍空
  FROM #deg
UNION ALL SELECT N'M2+M3（放宽时间下限：老工单也认）',
       SUM(CASE WHEN 档 <> N'M4 产品对得上但工单日期晚于入库日' AND 档 <> N'M5 产品在 plang 里完全没有' THEN 1 ELSE 0 END),
       231 - SUM(CASE WHEN 档 <> N'M4 产品对得上但工单日期晚于入库日' AND 档 <> N'M5 产品在 plang 里完全没有' THEN 1 ELSE 0 END)
  FROM #deg
UNION ALL SELECT N'M2+M3+M4（产品对得上就认，不管时间）',
       SUM(CASE WHEN 档 <> N'M5 产品在 plang 里完全没有' THEN 1 ELSE 0 END),
       SUM(CASE WHEN 档 = N'M5 产品在 plang 里完全没有' THEN 1 ELSE 0 END)
  FROM #deg
UNION ALL SELECT N'M2+M3+M4+M5（全补：无产品依据按时间最近工单硬落）', 231, 0 FROM #deg;
