SET NOCOUNT ON;
PRINT N'== 负组合的流水画像(TOP 12):累计入 / 累计出 / 有无期初 ==';
WITH g AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) net FROM dbo.kucun GROUP BY wzdm, ckdm),
neg AS (SELECT * FROM g WHERE net < -0.0001),
mv AS (
  SELECT 存货编码, 仓库编码, SUM(收入数量) AS ins, SUM(发出数量) AS outs,
         SUM(CASE WHEN src=0 THEN 收入数量 ELSE 0 END) AS opening
  FROM dbo.v_stock_movement GROUP BY 存货编码, 仓库编码
)
SELECT TOP 12 neg.wzdm AS 存货, neg.ckdm AS 仓库, CAST(neg.net AS decimal(18,4)) AS 结存,
       CAST(ISNULL(mv.opening,0) AS decimal(18,4)) AS 期初入,
       CAST(ISNULL(mv.ins,0) AS decimal(18,4)) AS 累计入,
       CAST(ISNULL(mv.outs,0) AS decimal(18,4)) AS 累计出
FROM neg LEFT JOIN mv ON mv.存货编码=neg.wzdm AND mv.仓库编码=neg.ckdm
ORDER BY neg.net;

PRINT N'== 负组合按"有无期初"分类 ==';
WITH g AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) net FROM dbo.kucun GROUP BY wzdm, ckdm),
neg AS (SELECT * FROM g WHERE net < -0.0001),
mv AS (SELECT 存货编码, 仓库编码, SUM(CASE WHEN src=0 THEN 收入数量 ELSE 0 END) AS opening
       FROM dbo.v_stock_movement GROUP BY 存货编码, 仓库编码)
SELECT SUM(CASE WHEN ISNULL(mv.opening,0) > 0 THEN 1 ELSE 0 END) AS 有期初的负组合,
       SUM(CASE WHEN ISNULL(mv.opening,0) <= 0 THEN 1 ELSE 0 END) AS 无期初的负组合,
       COUNT(*) AS 合计
FROM neg LEFT JOIN mv ON mv.存货编码=neg.wzdm AND mv.仓库编码=neg.ckdm;
