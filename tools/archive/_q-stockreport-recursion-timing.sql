-- DB 层实证:① 递归深度与 MAXRECURSION 的关系 ② 视图取数耗时(有/无 RECOMPILE)③ 依赖元数据
SET NOCOUNT ON;
-- ══ 0. 依赖元数据是不是"权限看不见"还是"根本没记"(全库对比)══
SELECT (SELECT COUNT(*) FROM sys.sql_expression_dependencies) AS 全库依赖行,
       (SELECT COUNT(*) FROM sys.sql_expression_dependencies d WHERE OBJECT_NAME(d.referencing_id) LIKE 'v_stock%') AS 库存视图依赖行;
GO
-- ══ 1. 递归 CTE:当前数据下不带 hint 能否跑通(最大分区 11 行 → 深度 11)══
DECLARE @t0 datetime2 = SYSDATETIME();
WITH s AS (
  SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
         ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
  FROM dbo.v_stock_movement
), rec AS (
  SELECT rn, 仓库键, 存货编码,
         CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
         CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 结存金额
  FROM s WHERE rn = 1
  UNION ALL
  SELECT s.rn, s.仓库键, s.存货编码,
         CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
         CAST(rec.结存金额 + s.收入金额 - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10))
  FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
)
SELECT COUNT(*) AS 不带hint的行数, DATEDIFF(ms, @t0, SYSDATETIME()) AS 耗时ms FROM rec;
GO
-- ══ 2. 把递归上限压到 5(< 最大分区 11)→ 证明"深度 > 上限即整条语句失败"的机制 ══
BEGIN TRY
  WITH s AS (
    SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
           ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
    FROM dbo.v_stock_movement
  ), rec AS (
    SELECT rn, 仓库键, 存货编码, CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
           CAST(收入金额 AS decimal(38,10)) AS 结存金额
    FROM s WHERE rn = 1
    UNION ALL
    SELECT s.rn, s.仓库键, s.存货编码,
           CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
           CAST(rec.结存金额 + s.收入金额 AS decimal(38,10))
    FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
  )
  SELECT COUNT(*) FROM rec OPTION (MAXRECURSION 5);
  PRINT N'[意外] MAXRECURSION 5 竟然成功了';
END TRY
BEGIN CATCH
  SELECT ERROR_NUMBER() AS 错误号, ERROR_MESSAGE() AS 错误信息;
END CATCH
GO
-- ══ 3. MAXRECURSION 0(无限)+ 计时:这是 Java 里唯一能绕过的写法 ══
DECLARE @t1 datetime2 = SYSDATETIME();
WITH s AS (
  SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
         ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
  FROM dbo.v_stock_movement
), rec AS (
  SELECT rn, 仓库键, 存货编码, CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
         CAST(收入金额 AS decimal(38,10)) AS 结存金额
  FROM s WHERE rn = 1
  UNION ALL
  SELECT s.rn, s.仓库键, s.存货编码,
         CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
         CAST(rec.结存金额 + s.收入金额 AS decimal(38,10))
  FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
)
SELECT COUNT(*) AS MAXRECURSION0行数, DATEDIFF(ms, @t1, SYSDATETIME()) AS 耗时ms FROM rec OPTION (MAXRECURSION 0);
GO
-- ══ 4. 三视图 + 底座取数耗时:无 hint vs OPTION(RECOMPILE)(各 3 轮取中位感觉)══
DECLARE @a datetime2, @b int, @i int;
DECLARE @res TABLE (对象 nvarchar(30), 模式 nvarchar(12), 轮次 int, 耗时ms int, 行数 int);
SET @i = 1;
WHILE @i <= 3
BEGIN
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_movement;      INSERT INTO @res VALUES (N'v_stock_movement', N'无hint', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_movement OPTION (RECOMPILE); INSERT INTO @res VALUES (N'v_stock_movement', N'RECOMPILE', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_ledger;        INSERT INTO @res VALUES (N'v_stock_ledger', N'无hint', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_ledger OPTION (RECOMPILE);   INSERT INTO @res VALUES (N'v_stock_ledger', N'RECOMPILE', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_summary;       INSERT INTO @res VALUES (N'v_stock_summary', N'无hint', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_summary OPTION (RECOMPILE);  INSERT INTO @res VALUES (N'v_stock_summary', N'RECOMPILE', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_balance;       INSERT INTO @res VALUES (N'v_stock_balance', N'无hint', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @a = SYSDATETIME(); SELECT @b = COUNT(*) FROM v_stock_balance OPTION (RECOMPILE);  INSERT INTO @res VALUES (N'v_stock_balance', N'RECOMPILE', @i, DATEDIFF(ms,@a,SYSDATETIME()), @b);
  SET @i = @i + 1;
END
SELECT 对象, 模式, MIN(耗时ms) AS 最快ms, MAX(耗时ms) AS 最慢ms, MAX(行数) AS 行数 FROM @res GROUP BY 对象, 模式 ORDER BY 对象, 模式;
GO
