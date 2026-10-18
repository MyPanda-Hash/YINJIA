SET NOCOUNT ON;

PRINT N'== 1. 两套现存量口径差异:库存明细(kucun) vs 库存状况表(v_stock_balance),按 仓库编码+存货编码 ==';
WITH k AS (
  SELECT RTRIM(ckdm) AS wh, RTRIM(wzdm) AS item, SUM(ISNULL(yl,0)) AS q FROM dbo.kucun
  WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY RTRIM(ckdm), RTRIM(wzdm)
), b AS (
  SELECT RTRIM(仓库编码) AS wh, RTRIM(存货编码) AS item, SUM(现存量) AS q FROM dbo.v_stock_balance GROUP BY RTRIM(仓库编码), RTRIM(存货编码)
)
SELECT (SELECT COUNT(*) FROM k) AS kucun键数,
       (SELECT COUNT(*) FROM b) AS 报表键数,
       SUM(CASE WHEN k.q IS NOT NULL AND b.q IS NOT NULL THEN 1 ELSE 0 END) AS 两边都有,
       SUM(CASE WHEN k.q IS NOT NULL AND b.q IS NULL THEN 1 ELSE 0 END) AS 仅kucun有,
       SUM(CASE WHEN k.q IS NULL AND b.q IS NOT NULL THEN 1 ELSE 0 END) AS 仅报表有,
       SUM(CASE WHEN k.q IS NOT NULL AND b.q IS NOT NULL AND ABS(k.q-b.q) > 0.0001 THEN 1 ELSE 0 END) AS 两边都有但数量不等
FROM k FULL OUTER JOIN b ON b.wh=k.wh AND b.item=k.item;

PRINT N'== 2. 差异最大的 15 个键(库存明细 vs 库存状况表) ==';
WITH k AS (
  SELECT RTRIM(ckdm) AS wh, RTRIM(wzdm) AS item, SUM(ISNULL(yl,0)) AS q FROM dbo.kucun
  WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY RTRIM(ckdm), RTRIM(wzdm)
), b AS (
  SELECT RTRIM(仓库编码) AS wh, RTRIM(存货编码) AS item, SUM(现存量) AS q FROM dbo.v_stock_balance GROUP BY RTRIM(仓库编码), RTRIM(存货编码)
)
SELECT TOP 15 ISNULL(k.wh,b.wh) AS 仓库, ISNULL(k.item,b.item) AS 存货,
       CAST(ISNULL(k.q,0) AS decimal(18,4)) AS 库存明细,
       CAST(ISNULL(b.q,0) AS decimal(18,4)) AS 库存状况表,
       CAST(ISNULL(b.q,0)-ISNULL(k.q,0) AS decimal(18,4)) AS 差异
FROM k FULL OUTER JOIN b ON b.wh=k.wh AND b.item=k.item
WHERE ABS(ISNULL(b.q,0)-ISNULL(k.q,0)) > 0.0001
ORDER BY ABS(ISNULL(b.q,0)-ISNULL(k.q,0)) DESC;

PRINT N'== 3. v_stock_balance 有而 kucun 无的键(报表显示有货、台账没有) ==';
WITH k AS (
  SELECT RTRIM(ckdm) AS wh, RTRIM(wzdm) AS item, SUM(ISNULL(yl,0)) AS q FROM dbo.kucun
  WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY RTRIM(ckdm), RTRIM(wzdm)
), b AS (
  SELECT RTRIM(仓库编码) AS wh, RTRIM(存货编码) AS item, SUM(现存量) AS q FROM dbo.v_stock_balance GROUP BY RTRIM(仓库编码), RTRIM(存货编码)
)
SELECT COUNT(*) AS 键数, CAST(SUM(b.q) AS decimal(18,4)) AS 合计
FROM b LEFT JOIN k ON k.wh=b.wh AND k.item=b.item WHERE k.q IS NULL;

PRINT N'== 4. kucun 有而报表无的键(台账有货、报表没有) ==';
WITH k AS (
  SELECT RTRIM(ckdm) AS wh, RTRIM(wzdm) AS item, SUM(ISNULL(yl,0)) AS q FROM dbo.kucun
  WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY RTRIM(ckdm), RTRIM(wzdm)
), b AS (
  SELECT RTRIM(仓库编码) AS wh, RTRIM(存货编码) AS item, SUM(现存量) AS q FROM dbo.v_stock_balance GROUP BY RTRIM(仓库编码), RTRIM(存货编码)
)
SELECT COUNT(*) AS 键数, CAST(SUM(k.q) AS decimal(18,4)) AS 合计
FROM k LEFT JOIN b ON b.wh=k.wh AND b.item=k.item WHERE b.q IS NULL;
