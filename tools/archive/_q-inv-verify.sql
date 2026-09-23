-- 回填后自检:取自 migrate-inv-report-fields.sql 末尾「自检」段落(逐字复制,便于单独复跑)
-- ══ 自检 ══
SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水行数,
       (SELECT COUNT(*) FROM inv_cost_ledger)  AS 成本行数,
       (SELECT COUNT(*) FROM v_stock_ledger)   AS 台账行数,
       (SELECT COUNT(*) FROM v_stock_summary)  AS 汇总行数,
       (SELECT COUNT(*) FROM v_stock_balance)  AS 状况行数;
GO
-- 成本覆盖:应为 0 行(每条流水都要有成本行)
SELECT COUNT(*) AS 无成本行的流水 FROM v_stock_movement m
LEFT JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid WHERE c.src IS NULL;
GO
-- 口径核对:结存金额 = Σ收入金额 − Σ发出成本;并给出新旧口径对比
SELECT CAST(SUM(收入金额) AS decimal(18,2)) AS 累计入库金额,
       CAST(SUM(发出金额) AS decimal(18,2)) AS 累计出库成本,
       CAST(SUM(收入金额-发出金额) AS decimal(18,2)) AS 结存金额合计,
       CAST(SUM(发出单据金额) AS decimal(18,2)) AS 累计发出单据金额,
       CAST(SUM(收入金额-发出单据金额) AS decimal(18,2)) AS 旧售价口径结存金额
FROM v_stock_ledger;
GO
-- 逐行勾稽:期初+收入−发出=期末 必须全部成立
SELECT COUNT(*) AS 勾稽不符行数 FROM v_stock_ledger
WHERE ABS((期初数量+收入数量-发出数量)-期末数量) > 0.0001;
GO
-- 批次级健康度(说明批号为何不能进 GROUP BY):分区数 / 只出无进 / 负结存
SELECT N'存货级(仓库,存货)' AS 口径, COUNT(*) AS 分区数,
       SUM(CASE WHEN 入=0 AND 出>0 THEN 1 ELSE 0 END) AS 只出无进
FROM (SELECT 仓库键, 存货编码, SUM(收入数量) AS 入, SUM(发出数量) AS 出
      FROM v_stock_movement GROUP BY 仓库键, 存货编码) a
UNION ALL
SELECT N'批次级(+批号)', COUNT(*), SUM(CASE WHEN 入=0 AND 出>0 THEN 1 ELSE 0 END)
FROM (SELECT 仓库键, 存货编码, 批号, SUM(收入数量) AS 入, SUM(发出数量) AS 出
      FROM v_stock_movement GROUP BY 仓库键, 存货编码, 批号) b;
GO
