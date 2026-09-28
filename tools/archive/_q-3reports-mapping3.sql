SET NOCOUNT ON;
-- ③ 为什么 92 > 86:状况表的 GROUP BY 比成本分区宽(多了 存货名/规格型号/主计量)
SELECT 仓库编码, 存货编码, COUNT(*) AS 状况表行数,
       COUNT(DISTINCT 仓库) AS 仓库名种数, COUNT(DISTINCT 存货) AS 存货名种数,
       COUNT(DISTINCT 规格型号) AS 规格种数, COUNT(DISTINCT 主计量) AS 单位种数
FROM v_stock_balance GROUP BY 仓库编码, 存货编码 HAVING COUNT(*) > 1;
GO
SELECT 仓库编码, 存货编码, 存货, 规格型号, 主计量, 现存量, 结存金额
FROM v_stock_balance WHERE 仓库编码 IN (SELECT 仓库编码 FROM v_stock_balance GROUP BY 仓库编码, 存货编码 HAVING COUNT(*)>1)
ORDER BY 仓库编码, 存货编码;
GO
SELECT DISTINCT src, 单据类型, 业务类型 FROM v_stock_movement ORDER BY src;
GO
SELECT COUNT(*) AS 台账聚合后的组合数, SUM(笔) AS 覆盖流水笔数, MAX(笔) AS 单组合最多笔数
FROM (SELECT 仓库编码, 存货编码, CONVERT(nvarchar(7),单据日期,120) AS 期次, COUNT(*) AS 笔
      FROM v_stock_ledger GROUP BY 仓库编码, 存货编码, CONVERT(nvarchar(7),单据日期,120)) t;
GO
