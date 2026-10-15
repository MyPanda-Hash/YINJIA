/* q-16-rec-null.sql — 诊断:#rec 里到底哪一列出了 NULL(只读,不写 inv_cost_ledger) */
SET NOCOUNT ON;
GO
IF OBJECT_ID('tempdb..#s') IS NOT NULL DROP TABLE #s;
SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
       ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
  INTO #s FROM dbo.v_stock_movement;
CREATE UNIQUE CLUSTERED INDEX IX_s ON #s (仓库键, 存货编码, rn);
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
SELECT N'#rec 空值统计' AS k, COUNT(*) AS 行数,
       SUM(CASE WHEN src IS NULL THEN 1 ELSE 0 END) AS src_null,
       SUM(CASE WHEN rid IS NULL THEN 1 ELSE 0 END) AS rid_null,
       SUM(CASE WHEN 仓库键 IS NULL THEN 1 ELSE 0 END) AS 仓库键_null,
       SUM(CASE WHEN 存货编码 IS NULL THEN 1 ELSE 0 END) AS 存货编码_null,
       SUM(CASE WHEN 批号 IS NULL THEN 1 ELSE 0 END) AS 批号_null,
       SUM(CASE WHEN 单据日期 IS NULL THEN 1 ELSE 0 END) AS 单据日期_null,
       SUM(CASE WHEN 结存数量 IS NULL THEN 1 ELSE 0 END) AS 结存数量_null,
       SUM(CASE WHEN 结存金额 IS NULL THEN 1 ELSE 0 END) AS 结存金额_null,
       SUM(CASE WHEN 发出成本金额 IS NULL THEN 1 ELSE 0 END) AS 发出成本_null
FROM #rec;
GO
SELECT c.column_id, c.name, TYPE_NAME(c.user_type_id) AS typ, c.max_length, c.is_nullable
FROM sys.columns c WHERE c.object_id = OBJECT_ID('tempdb..#rec') ORDER BY c.column_id;
GO
