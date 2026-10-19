SET NOCOUNT ON;

PRINT N'== 1. v_stock_balance(库存状况表来源) 分布 ==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(现存量,0)<-0.0001 THEN 1 ELSE 0 END) AS 负行数,
       SUM(CASE WHEN ISNULL(现存量,0)>0.0001 THEN 1 ELSE 0 END) AS 正行数,
       SUM(CASE WHEN ABS(ISNULL(现存量,0))<=0.0001 THEN 1 ELSE 0 END) AS 零行数,
       CAST(SUM(现存量) AS decimal(18,4)) AS 合计,
       CAST(MIN(现存量) AS decimal(18,4)) AS 最小值
FROM dbo.v_stock_balance;

PRINT N'== 2. v_stock_kucun(库存明细来源) 分布 ==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(现存量,0)<-0.0001 THEN 1 ELSE 0 END) AS 负行数,
       SUM(CASE WHEN ISNULL(现存量,0)>0.0001 THEN 1 ELSE 0 END) AS 正行数,
       SUM(CASE WHEN ABS(ISNULL(现存量,0))<=0.0001 THEN 1 ELSE 0 END) AS 零行数,
       CAST(SUM(现存量) AS decimal(18,4)) AS 合计,
       CAST(MIN(现存量) AS decimal(18,4)) AS 最小值
FROM dbo.v_stock_kucun;

PRINT N'== 3. v_stock_pick(库存选货来源) 分布 ==';
SELECT COUNT(*) AS 行数,
       SUM(CASE WHEN ISNULL(现存量,0)<=0 THEN 1 ELSE 0 END) AS 非正行数,
       CAST(SUM(现存量) AS decimal(18,4)) AS 合计,
       CAST(MIN(现存量) AS decimal(18,4)) AS 最小值
FROM dbo.v_stock_pick;

PRINT N'== 4. 按(物料,仓库)合计口径: 有多少组合真为负(不等于批号负行) ==';
WITH g AS (
  SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS net FROM dbo.kucun GROUP BY wzdm, ckdm
)
SELECT COUNT(*) AS 组合数,
       SUM(CASE WHEN net < -0.0001 THEN 1 ELSE 0 END) AS 组合合计为负,
       SUM(CASE WHEN net > 0.0001 THEN 1 ELSE 0 END) AS 组合合计为正,
       CAST(SUM(CASE WHEN net<0 THEN net ELSE 0 END) AS decimal(18,4)) AS 真缺口合计
FROM g;

PRINT N'== 5. 假负行:批号行负 但 (物料,仓库) 合计为正 ==';
WITH g AS (
  SELECT wzdm, ckdm, SUM(ISNULL(yl,0)) AS net FROM dbo.kucun GROUP BY wzdm, ckdm
)
SELECT COUNT(*) AS 假负行数, CAST(SUM(k.yl) AS decimal(18,4)) AS 假负余量
FROM dbo.kucun k JOIN g ON g.wzdm=k.wzdm AND g.ckdm=k.ckdm
WHERE k.yl < -0.0001 AND g.net > 0.0001;

PRINT N'== 6. 各视图行数对照 ==';
SELECT (SELECT COUNT(*) FROM dbo.v_stock_balance) AS v_stock_balance,
       (SELECT COUNT(*) FROM dbo.v_stock_kucun) AS v_stock_kucun,
       (SELECT COUNT(*) FROM dbo.v_stock_pick) AS v_stock_pick,
       (SELECT COUNT(*) FROM dbo.v_stock_movement) AS v_stock_movement,
       (SELECT COUNT(*) FROM dbo.v_stock_ledger) AS v_stock_ledger,
       (SELECT COUNT(*) FROM dbo.v_stock_summary) AS v_stock_summary;
