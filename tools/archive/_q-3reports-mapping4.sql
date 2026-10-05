SET NOCOUNT ON;
-- A. 当前流水来自哪几类单据
SELECT src, 单据类型, COUNT(*) AS 笔数 FROM v_stock_movement GROUP BY src, 单据类型 ORDER BY src;
GO
-- B. 台账 243 → 按「汇总视图的完整分组列」聚合后是多少(应=145)
SELECT COUNT(*) AS 按汇总视图分组列的组合数
FROM (SELECT 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位, CONVERT(nvarchar(7),单据日期,120) AS 期次
      FROM v_stock_ledger GROUP BY 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位, CONVERT(nvarchar(7),单据日期,120)) t;
GO
-- C. 劈行是否导致单价与成本表的移动加权单价不一致
SELECT b.仓库编码, b.存货编码, b.规格型号, b.主计量, b.现存量, b.结存单价 AS 状况表单价,
       MAX(c.移动加权单价) AS 成本表分区末单价
FROM v_stock_balance b
LEFT JOIN inv_cost_ledger c ON c.仓库键 = b.仓库编码 AND c.存货编码 = b.存货编码
WHERE b.仓库编码='CK00006' AND b.存货编码='YJ-SX-031'
GROUP BY b.仓库编码, b.存货编码, b.规格型号, b.主计量, b.现存量, b.结存单价;
GO
