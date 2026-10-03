SET NOCOUNT ON;
PRINT '--- 两个口径的规模 ---';
SELECT (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun行,
       (SELECT COUNT(DISTINCT wzdm) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun物料,
       (SELECT ISNULL(SUM(yl),0) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun余量合计,
       (SELECT COUNT(*) FROM v_stock_balance) AS bal行,
       (SELECT COUNT(DISTINCT 存货编码) FROM v_stock_balance) AS bal物料,
       (SELECT ISNULL(SUM(现存量),0) FROM v_stock_balance) AS bal现存量合计;
PRINT '--- 按物料对比(前 15 条有差异的) ---';
SELECT TOP 15 ISNULL(k.wzdm, b.存货编码) AS 物料,
       ISNULL(k.kc,0) AS kucun余量, ISNULL(b.bq,0) AS 视图现存量, ISNULL(b.bq,0) - ISNULL(k.kc,0) AS 差
FROM (SELECT wzdm, SUM(ISNULL(yl,0)) AS kc FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm) k
FULL JOIN (SELECT 存货编码, SUM(ISNULL(现存量,0)) AS bq FROM v_stock_balance GROUP BY 存货编码) b
  ON b.存货编码 = k.wzdm
WHERE ABS(ISNULL(b.bq,0) - ISNULL(k.kc,0)) > 0.0001
ORDER BY ABS(ISNULL(b.bq,0) - ISNULL(k.kc,0)) DESC;
PRINT '--- 只看有差异的物料条数 ---';
SELECT COUNT(*) AS 差异物料数 FROM
 (SELECT ISNULL(k.wzdm, b.存货编码) AS m, ISNULL(k.kc,0) AS kc, ISNULL(b.bq,0) AS bq
  FROM (SELECT wzdm, SUM(ISNULL(yl,0)) AS kc FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY wzdm) k
  FULL JOIN (SELECT 存货编码, SUM(ISNULL(现存量,0)) AS bq FROM v_stock_balance GROUP BY 存货编码) b ON b.存货编码 = k.wzdm) t
 WHERE ABS(bq - kc) > 0.0001;
