-- q-09-four-report-crosscheck.sql — 库存报表四表交叉核对(正式库)
SET NOCOUNT ON;
-- ① 四表总量
SELECT N'总量对照' AS k, N'kucun 结存缓存 Σyl' AS 口径, CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) AS 值 FROM kucun
UNION ALL SELECT N'总量对照', N'① 库存状况表 Σ现存量', CAST(SUM(现存量) AS decimal(18,4)) FROM v_stock_balance
UNION ALL SELECT N'总量对照', N'② 库存台账 Σ(收入−发出)', CAST(SUM(收入数量 - 发出数量) AS decimal(18,4)) FROM v_stock_ledger
UNION ALL SELECT N'总量对照', N'③ 收发存汇总 最新期次 Σ期末结存', CAST(SUM(期末结存数量) AS decimal(18,4)) FROM v_stock_summary
 WHERE 期次 = (SELECT MAX(期次) FROM v_stock_summary)
UNION ALL SELECT N'总量对照', N'④ 库存明细 Σ现存量', CAST(SUM(现存量) AS decimal(18,4)) FROM v_stock_kucun;
GO
-- ② 收发存汇总有哪些期次(确认"最新期次"选得对)
SELECT N'收发存期次' AS k, 期次, COUNT(*) AS 行数, CAST(SUM(期末结存数量) AS decimal(18,4)) AS 期末结存
FROM v_stock_summary GROUP BY 期次 ORDER BY 期次;
GO
-- ③ 库存明细 vs 库存状况表:逐 (仓库,存货) 比差额(前 10 大)
SELECT TOP 10 N'明细 vs 状况表 差异' AS k, ISNULL(d.存货编码, b.存货编码) AS 存货编码,
       ISNULL(d.仓库编码, b.仓库编码) AS 仓库编码,
       d.现存量 AS 明细现存量, b.现存量 AS 状况表现存量,
       CAST(ISNULL(d.现存量,0) - ISNULL(b.现存量,0) AS decimal(18,4)) AS 差额
FROM v_stock_kucun d FULL JOIN v_stock_balance b
  ON b.存货编码 = d.存货编码 AND b.仓库编码 = d.仓库编码
WHERE ABS(ISNULL(d.现存量,0) - ISNULL(b.现存量,0)) > 0.0001
ORDER BY ABS(ISNULL(d.现存量,0) - ISNULL(b.现存量,0)) DESC;
GO
-- ④ 差异键总数 + 差异合计
SELECT N'差异汇总' AS k, COUNT(*) AS 差异键数, CAST(SUM(d.现存量 - b.现存量) AS decimal(18,4)) AS 差异合计,
       (SELECT COUNT(*) FROM v_stock_kucun) AS 明细键数, (SELECT COUNT(*) FROM v_stock_balance) AS 状况表键数
FROM v_stock_kucun d JOIN v_stock_balance b
  ON b.存货编码 = d.存货编码 AND b.仓库编码 = d.仓库编码
WHERE ABS(d.现存量 - b.现存量) > 0.0001;
GO
-- ⑤ 台账是否覆盖每一笔流水(条数对账):v_stock_movement 行数 vs 台账非期初行数
SELECT N'台账覆盖' AS k,
       (SELECT COUNT(*) FROM v_stock_movement) AS 流水行数,
       (SELECT COUNT(*) FROM v_stock_ledger WHERE 单据编号 IS NOT NULL AND 单据编号 <> N'') AS 台账单据行数,
       (SELECT COUNT(*) FROM v_stock_ledger WHERE 单据编号 IS NULL OR 单据编号 = N'') AS 台账合成期初行数;
GO
