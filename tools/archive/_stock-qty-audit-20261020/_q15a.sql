SET NOCOUNT ON;
PRINT N'== 1. 现存量提取口径复算(前端只取 STOCK_STATUS 前 500 行, id DESC) ==';
WITH top500 AS (
  SELECT TOP 500 id, wzdm, ckdm, yl FROM dbo.kucun ORDER BY id DESC
), allrows AS (
  SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS yl FROM dbo.kucun GROUP BY wzdm, ckdm
), t500 AS (
  SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS yl FROM top500 GROUP BY wzdm, ckdm
)
SELECT (SELECT COUNT(DISTINCT wzdm) FROM dbo.kucun) AS [全部存货数],
       (SELECT COUNT(DISTINCT wzdm) FROM top500) AS [前500覆盖存货数],
       (SELECT COUNT(*) FROM allrows) AS [全部键],
       (SELECT COUNT(*) FROM t500) AS [前500覆盖键],
       (SELECT COUNT(*) FROM allrows a LEFT JOIN t500 t ON t.wzdm=a.wzdm AND t.ckdm=a.ckdm WHERE t.wzdm IS NULL AND a.yl<>0) AS [取不到的键],
       (SELECT COUNT(*) FROM allrows a JOIN t500 t ON t.wzdm=a.wzdm AND t.ckdm=a.ckdm WHERE ABS(a.yl-t.yl)>0.0001) AS [取到但不全的键];
