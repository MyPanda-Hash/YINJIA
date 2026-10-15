/* q-14-recalc-new-timing.sql — 新版重算路径试跑(整段 BEGIN TRAN … ROLLBACK,不留痕,只读效果)
   思路:s 落 #s + 聚簇索引(仓库键,存货编码,rn) ⇒ 递归段 seek;递归算完再 DELETE,缩短写锁窗口 */
SET NOCOUNT ON;
GO
DECLARE @r TABLE (步骤 nvarchar(40), ms int, 行数 int);
DECLARE @t datetime2;
BEGIN TRAN;

  SET @t = SYSDATETIME();
  IF OBJECT_ID('tempdb..#s') IS NOT NULL DROP TABLE #s;
  SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
         ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
    INTO #s
    FROM dbo.v_stock_movement;
  INSERT INTO @r VALUES (N'① 落 #s(读视图+行号)', DATEDIFF(ms, @t, SYSDATETIME()), (SELECT COUNT(*) FROM #s));

  SET @t = SYSDATETIME();
  CREATE UNIQUE CLUSTERED INDEX IX_s ON #s (仓库键, 存货编码, rn);
  INSERT INTO @r VALUES (N'② 建聚簇索引', DATEDIFF(ms, @t, SYSDATETIME()), 0);

  SET @t = SYSDATETIME();
  IF OBJECT_ID('tempdb..#rec') IS NOT NULL DROP TABLE #rec;
  ;WITH rec AS (
    SELECT rn, src, rid, 仓库键, 存货编码, 批号, 单据日期,
           CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
           CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 结存金额,
           CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END) AS decimal(38,10)) AS 发出成本金额,
           CAST(收入数量 AS decimal(38,10)) AS 收入数量, CAST(发出数量 AS decimal(38,10)) AS 发出数量, CAST(收入金额 AS decimal(38,10)) AS 收入金额
      FROM #s WHERE rn = 1
    UNION ALL
    SELECT s.rn, s.src, s.rid, s.仓库键, s.存货编码, s.批号, s.单据日期,
           CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
           CAST(rec.结存金额 + s.收入金额 - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
           CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
           CAST(s.收入数量 AS decimal(38,10)), CAST(s.发出数量 AS decimal(38,10)), CAST(s.收入金额 AS decimal(38,10))
      FROM rec JOIN #s s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
  )
  SELECT * INTO #rec FROM rec OPTION (MAXRECURSION 0);
  INSERT INTO @r VALUES (N'③ 递归主体(进 #rec)', DATEDIFF(ms, @t, SYSDATETIME()), (SELECT COUNT(*) FROM #rec));

  SET @t = SYSDATETIME();
  DELETE FROM dbo.inv_cost_ledger;
  INSERT INTO dbo.inv_cost_ledger
    (src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
     结存数量, 移动加权单价, 结存金额, 发出成本金额, 重算时间)
  SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,
         CAST(收入数量 AS decimal(18,4)), CAST(发出数量 AS decimal(18,4)), CAST(收入金额 AS decimal(18,4)),
         CAST(结存数量 AS decimal(18,4)),
         CAST(CASE WHEN 结存数量 <> 0 THEN 结存金额 / 结存数量 ELSE 0 END AS decimal(18,6)),
         CAST(结存金额 AS decimal(18,4)), CAST(发出成本金额 AS decimal(18,4)), SYSDATETIME()
    FROM #rec;
  INSERT INTO @r VALUES (N'④ 写库(DELETE+INSERT)', DATEDIFF(ms, @t, SYSDATETIME()), (SELECT COUNT(*) FROM dbo.inv_cost_ledger));

ROLLBACK;
DROP TABLE #rec; DROP TABLE #s;
SELECT 步骤, ms, 行数 FROM @r;
GO
