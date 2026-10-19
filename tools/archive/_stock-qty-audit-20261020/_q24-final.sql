SET NOCOUNT ON;
PRINT N'== 汇总复核 ==';
SELECT N'kucun 负行' AS 指标, COUNT(*) AS 值, CAST(SUM(yl) AS decimal(18,4)) AS 金额或合计
FROM dbo.kucun WHERE yl < -0.0001
UNION ALL
SELECT N'kucun 负组合(物料,仓库)', COUNT(*), CAST(SUM(net) AS decimal(18,4))
FROM (SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) net FROM dbo.kucun GROUP BY wzdm, ckdm) g WHERE net < -0.0001
UNION ALL
SELECT N'v_stock_balance 负行', COUNT(*), CAST(SUM(现存量) AS decimal(18,4))
FROM dbo.v_stock_balance WHERE 现存量 < -0.0001
UNION ALL
SELECT N'v_stock_kucun 负行', COUNT(*), CAST(SUM(现存量) AS decimal(18,4))
FROM dbo.v_stock_kucun WHERE 现存量 < -0.0001
UNION ALL
SELECT N'v_stock_pick 非正行', COUNT(*), CAST(SUM(现存量) AS decimal(18,4))
FROM dbo.v_stock_pick WHERE 现存量 <= 0
UNION ALL
SELECT N'kucun 总量', COUNT(*), CAST(SUM(yl) AS decimal(18,4)) FROM dbo.kucun;

PRINT N'== 报表现存量为负、但台账(仓库,存货)合计不为负 的行(单位/规格拆分) ==';
WITH g AS (SELECT RTRIM(wzdm) w, RTRIM(ckdm) c, SUM(ISNULL(yl,0)) net FROM dbo.kucun GROUP BY RTRIM(wzdm), RTRIM(ckdm))
SELECT b.仓库编码, b.存货编码, b.主计量, CAST(b.现存量 AS decimal(18,4)) AS 报表现存量,
       CAST(ISNULL(g.net,0) AS decimal(18,4)) AS 台账合计
FROM dbo.v_stock_balance b LEFT JOIN g ON g.w=RTRIM(b.存货编码) AND g.c=RTRIM(b.仓库编码)
WHERE b.现存量 < -0.0001 AND ISNULL(g.net,0) >= -0.0001;
