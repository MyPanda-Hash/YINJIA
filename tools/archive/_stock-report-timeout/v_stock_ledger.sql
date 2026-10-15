
CREATE VIEW dbo.v_stock_ledger AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库键, m.存货编码, m.单据日期, m.src, m.rid) AS id,
       CONVERT(nvarchar(10), m.单据日期, 120) AS 开始日期,
       CONVERT(nvarchar(10), m.单据日期, 120) AS 结束日期,
       m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.单据日期, m.单据类型, m.单据编号, m.业务类型, m.往来单位, m.往来单位编码, m.经手人,
       ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量 AS 期初数量,
       CASE WHEN ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量 <> 0
            THEN (ISNULL(c.结存金额,0) - m.收入金额 + ISNULL(c.发出成本金额,0))
                 / (ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量)
            ELSE 0 END AS 期初平均单价,
       ISNULL(c.结存金额,0) - m.收入金额 + ISNULL(c.发出成本金额,0) AS 期初金额,
       m.收入数量,
       CASE WHEN m.收入数量<>0 THEN m.收入金额/m.收入数量 ELSE 0 END AS 收入单价,
       m.收入金额,
       m.含税金额, m.税额,
       m.发出数量,
       CASE WHEN m.发出数量<>0 THEN ISNULL(c.发出成本金额,0)/m.发出数量 ELSE 0 END AS 发出单价,
       ISNULL(c.发出成本金额,0) AS 发出金额,
       m.发出单据金额,
       ISNULL(c.结存数量,0) AS 期末数量,
       ISNULL(c.移动加权单价,0) AS 期末平均单价,
       ISNULL(c.结存金额,0) AS 期末金额,
       CAST('N' AS char(1)) AS asp_cancel
FROM dbo.v_stock_movement m
LEFT JOIN dbo.inv_cost_ledger c ON c.src = m.src AND c.rid = m.rid;
