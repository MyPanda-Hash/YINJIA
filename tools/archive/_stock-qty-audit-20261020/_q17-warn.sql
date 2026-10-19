SET NOCOUNT ON;
PRINT N'== 1. 台账口径:负结存 (物料,仓库) 组合 TOP 15 ==';
WITH g AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS net FROM dbo.kucun GROUP BY wzdm, ckdm)
SELECT TOP 15 wzdm AS [存货编码], ckdm AS [仓库], CAST(net AS decimal(18,4)) AS [合计结存]
FROM g WHERE net < -0.0001 ORDER BY net;

PRINT N'== 2. 这些负组合的存货,在别的仓库是否还有正库存 ==';
WITH g AS (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS net FROM dbo.kucun GROUP BY wzdm, ckdm),
neg AS (SELECT * FROM g WHERE net < -0.0001),
pos AS (SELECT wzdm, SUM(CASE WHEN net>0 THEN net ELSE 0 END) AS pos_other FROM g GROUP BY wzdm)
SELECT COUNT(*) AS 负组合数,
       SUM(CASE WHEN ISNULL(p.pos_other,0) > 0.0001 THEN 1 ELSE 0 END) AS 其它仓库尚有正库存,
       SUM(CASE WHEN ISNULL(p.pos_other,0) <= 0.0001 THEN 1 ELSE 0 END) AS 全厂都缺
FROM neg n LEFT JOIN pos p ON p.wzdm=n.wzdm;

PRINT N'== 3. 库存状况表负行 与 台账负组合 的差集(9 行差异来源) ==';
WITH g AS (SELECT RTRIM(wzdm) AS w, RTRIM(ckdm) AS c, SUM(ISNULL(yl,0)) AS net FROM dbo.kucun GROUP BY RTRIM(wzdm), RTRIM(ckdm))
SELECT b.仓库编码, b.仓库, b.存货编码, b.存货, CAST(b.现存量 AS decimal(18,4)) AS [报表现存量]
FROM dbo.v_stock_balance b
LEFT JOIN g ON g.w=b.存货编码 AND g.c=b.仓库编码
WHERE b.现存量 < -0.0001 AND (g.net IS NULL OR g.net >= -0.0001);

PRINT N'== 4. 预警口径差异:阈值按 0 与按"未设=50" 各报多少 ==';
SELECT
  (SELECT COUNT(*) FROM dbo.kucun WHERE ISNULL(yl,0) < ISNULL(NULLIF(预警数量,0),50)) AS [门户口径_未设按50],
  (SELECT COUNT(*) FROM dbo.kucun WHERE ISNULL(预警数量,0) > 0 AND ISNULL(yl,0) < 预警数量) AS [看板口径_未设按0],
  (SELECT COUNT(*) FROM dbo.v_stock_balance WHERE ISNULL(预警数量,0) > 0 AND ISNULL(现存量,0) < 预警数量) AS [库存状况表口径],
  (SELECT COUNT(*) FROM dbo.v_stock_balance WHERE ISNULL(现存量,0) < 0) AS [库存状况表负行];
