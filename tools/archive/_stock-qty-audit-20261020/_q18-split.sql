SET NOCOUNT ON;
PRINT N'== 1. 库存状况表:同一(仓库编码,存货编码) 被 仓库键 拆成多行的情况 ==';
WITH d AS (
  SELECT 仓库编码, 存货编码, COUNT(*) AS rows_per_key, COUNT(DISTINCT 仓库) AS wh_names
  FROM dbo.v_stock_balance GROUP BY 仓库编码, 存货编码 HAVING COUNT(*) > 1
)
SELECT COUNT(*) AS [被拆的键数], SUM(rows_per_key) AS [涉及行数], SUM(CASE WHEN wh_names>1 THEN 1 ELSE 0 END) AS [仓库名不一致的]
FROM d;

PRINT N'== 2. 示例:被拆且其中一行是负的 ==';
WITH d AS (
  SELECT 仓库编码, 存货编码 FROM dbo.v_stock_balance GROUP BY 仓库编码, 存货编码 HAVING COUNT(*) > 1
)
SELECT TOP 12 b.仓库编码, b.仓库, b.存货编码, b.存货, CAST(b.现存量 AS decimal(18,4)) AS [现存量]
FROM dbo.v_stock_balance b JOIN d ON d.仓库编码=b.仓库编码 AND d.存货编码=b.存货编码
WHERE d.存货编码 IN (SELECT 存货编码 FROM dbo.v_stock_balance WHERE 现存量 < 0)
ORDER BY b.存货编码, b.现存量;

PRINT N'== 3. 台账负行(359)里:真缺货 vs 批次错配 的最终划分 ==';
WITH g AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS net FROM dbo.kucun GROUP BY wzdm, ckdm)
SELECT SUM(CASE WHEN g.net >= -0.0001 THEN 1 ELSE 0 END) AS [假负_货在其它批次],
       SUM(CASE WHEN g.net < -0.0001 THEN 1 ELSE 0 END) AS [真负_整个仓缺货],
       COUNT(*) AS [负行合计]
FROM dbo.kucun k JOIN g ON g.wzdm=k.wzdm AND g.ckdm=k.ckdm
WHERE k.yl < -0.0001;
