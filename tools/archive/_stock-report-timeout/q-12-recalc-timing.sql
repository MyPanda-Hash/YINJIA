/* q-12-recalc-timing.sql — 移动加权成本重算的递归主体到底多慢(只读:只跑 CTE,不写表) */
SET NOCOUNT ON;
GO
DECLARE @r TABLE (行数 int, 分区数 int);
DECLARE @t datetime2 = SYSDATETIME();
WITH s AS (
  SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
         ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
  FROM dbo.v_stock_movement
), rec AS (
  SELECT rn, src, rid, 仓库键, 存货编码, 批号, 单据日期,
         CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
         CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 结存金额,
         CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 发出成本金额,
         CAST(收入数量 AS decimal(38,10)) AS 收入数量, CAST(发出数量 AS decimal(38,10)) AS 发出数量, CAST(收入金额 AS decimal(38,10)) AS 收入金额
  FROM s WHERE rn = 1
  UNION ALL
  SELECT s.rn, s.src, s.rid, s.仓库键, s.存货编码, s.批号, s.单据日期,
         CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
         CAST(rec.结存金额 + s.收入金额 - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
         CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
         CAST(s.收入数量 AS decimal(38,10)), CAST(s.发出数量 AS decimal(38,10)), CAST(s.收入金额 AS decimal(38,10))
  FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
)
INSERT INTO @r (行数, 分区数)
SELECT COUNT(*), COUNT(DISTINCT 仓库键 + N'|' + 存货编码) FROM rec OPTION (MAXRECURSION 0);
SELECT N'重算递归主体(只读,不含 DELETE/INSERT)' AS k, 行数, 分区数, DATEDIFF(ms, @t, SYSDATETIME()) AS 耗时ms FROM @r;
GO
