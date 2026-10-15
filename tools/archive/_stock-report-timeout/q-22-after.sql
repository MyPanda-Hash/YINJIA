/* q-22-after.sql — 补期初 + 重算后的最终状态(只读) */
SET NOCOUNT ON;
GO
SELECT N'inv_cost_ledger' AS k, COUNT(*) AS 行数,
       CAST(SUM(结存金额) AS decimal(18,2)) AS 结存金额逐行合计,
       CAST(SUM(发出成本金额) AS decimal(18,2)) AS 发出成本合计,
       CONVERT(nvarchar(23), MAX(重算时间), 121) AS 最近重算
FROM dbo.inv_cost_ledger;
GO
SELECT N'三张报表合计' AS k,
       (SELECT COUNT(*) FROM v_stock_balance) AS 状况行,
       (SELECT CAST(SUM(现存量) AS decimal(18,2)) FROM v_stock_balance) AS 现存量合计,
       (SELECT CAST(SUM(结存金额) AS decimal(18,2)) FROM v_stock_balance) AS 结存金额合计,
       (SELECT COUNT(*) FROM v_stock_ledger) AS 台账行,
       (SELECT COUNT(*) FROM v_stock_summary) AS 汇总行;
GO
SELECT N'流水分段' AS k, src, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计
FROM (SELECT src, 数量 FROM dbo.inh WHERE ISNULL(asp_cancel,'N')<>'Y'
      UNION ALL SELECT src, 数量 FROM dbo.outh WHERE ISNULL(asp_cancel,'N')<>'Y') t
GROUP BY src ORDER BY src;
GO
SELECT N'勾稽:流水净额 vs kucun' AS k,
       (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM dbo.inh WHERE ISNULL(asp_cancel,'N')<>'Y')
     - (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM dbo.outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 流水净额,
       (SELECT CAST(SUM(yl) AS decimal(18,2)) FROM dbo.kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun余量;
GO
