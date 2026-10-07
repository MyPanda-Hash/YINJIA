SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水行,
       (SELECT COUNT(*) FROM inv_cost_ledger) AS 成本行,
       (SELECT COUNT(*) FROM v_stock_movement m JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid) AS 流水配成本对;
GO
-- 台账到底外露了哪些列(找 src/rid)
SELECT c.name AS 台账列 FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.v_stock_ledger') ORDER BY c.column_id;
GO
SELECT 仓库键, 存货编码, COUNT(*) AS 状况表行数,
       COUNT(DISTINCT 仓库) AS 仓库名种数, COUNT(DISTINCT 规格型号) AS 规格种数, COUNT(DISTINCT 主计量) AS 单位种数
FROM v_stock_balance GROUP BY 仓库键, 存货编码 HAVING COUNT(*) > 1;
GO
SELECT DISTINCT src, 单据类型, 业务类型 FROM v_stock_movement ORDER BY src;
GO
SELECT COUNT(*) AS 台账聚合后的组合数, SUM(笔) AS 覆盖流水笔数, MAX(笔) AS 单组合最多笔数
FROM (SELECT 仓库编码, 存货编码, CONVERT(nvarchar(7),单据日期,120) AS 期次, COUNT(*) AS 笔
      FROM v_stock_ledger GROUP BY 仓库编码, 存货编码, CONVERT(nvarchar(7),单据日期,120)) t;
GO
