SET NOCOUNT ON;
SELECT 'v_stock_movement 行数(=已审核出入库明细笔数)' AS 口径, COUNT(*) AS 值 FROM v_stock_movement
UNION ALL SELECT 'v_stock_ledger 行数(=逐笔流水)', COUNT(*) FROM v_stock_ledger
UNION ALL SELECT 'inv_cost_ledger 行数(=每笔一行成本)', COUNT(*) FROM inv_cost_ledger
UNION ALL SELECT '按 (仓库键,存货编码) 的成本分区数', COUNT(*) FROM (SELECT 仓库键, 存货编码 FROM v_stock_movement GROUP BY 仓库键, 存货编码) a
UNION ALL SELECT 'v_stock_balance 行数(=状况表行)', COUNT(*) FROM v_stock_balance
UNION ALL SELECT 'v_stock_summary 行数(=汇总行)', COUNT(*) FROM v_stock_summary;
GO
SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水行,
       (SELECT COUNT(*) FROM inv_cost_ledger) AS 成本行,
       (SELECT COUNT(*) FROM v_stock_movement m JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid) AS 流水配成本对,
       (SELECT COUNT(*) FROM v_stock_ledger l JOIN inv_cost_ledger c ON c.src=l.src AND c.rid=l.rid) AS 台账配成本对;
GO
SELECT 仓库键, 存货编码, COUNT(*) AS 状况表行数,
       COUNT(DISTINCT 仓库) AS 仓库名种数, COUNT(DISTINCT 规格型号) AS 规格种数, COUNT(DISTINCT 主计量) AS 单位种数
FROM v_stock_balance GROUP BY 仓库键, 存货编码 HAVING COUNT(*) > 1;
GO
SELECT DISTINCT src, 单据类型, 业务类型 FROM v_stock_movement ORDER BY src;
GO
SELECT COUNT(*) AS 台账聚合后的(仓库,存货,期次)组合数, SUM(笔) AS 覆盖流水笔数, MAX(笔) AS 单组合最多笔数, AVG(笔) AS 平均笔数
FROM (SELECT 仓库编码, 存货编码, CONVERT(nvarchar(7),单据日期,120) AS 期次, COUNT(*) AS 笔
      FROM v_stock_ledger GROUP BY 仓库编码, 存货编码, CONVERT(nvarchar(7),单据日期,120)) t;
GO
