-- q-15-kucun-vs-balance.sql — KUCUN 现存量 vs 库存状况表(v_stock_balance,流水口径)对账 —— 决定「库存明细」该信谁
SET NOCOUNT ON;
SELECT N'v_stock_balance 汇总' AS k, COUNT(*) AS 行数, SUM(现存量) AS 现存量合计, SUM(结存金额) AS 结存金额合计
FROM v_stock_balance;
GO
SELECT N'kucun 汇总' AS k, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 现存量合计
FROM kucun;
GO
SELECT N'两边键对照(前 15 差异)' AS k, k.wzdm, k.ckdm, SUM(k.yl) AS kucun现存量, b.现存量 AS 状况表现存量,
       SUM(k.yl) - ISNULL(b.现存量, 0) AS 差
FROM kucun k
LEFT JOIN (SELECT 仓库编码, 存货编码, SUM(现存量) AS 现存量 FROM v_stock_balance GROUP BY 仓库编码, 存货编码) b
       ON b.仓库编码 = k.ckdm AND b.存货编码 = k.wzdm
GROUP BY k.wzdm, k.ckdm, b.现存量
HAVING ABS(SUM(k.yl) - ISNULL(b.现存量, 0)) > 0.005
ORDER BY ABS(SUM(k.yl) - ISNULL(b.现存量, 0)) DESC
OFFSET 0 ROWS FETCH NEXT 15 ROWS ONLY;
GO
SELECT N'差异规模' AS k,
       COUNT(*) AS 有差异键数,
       SUM(CASE WHEN b.现存量 IS NULL THEN 1 ELSE 0 END) AS 状况表无此行
FROM (SELECT wzdm, ckdm, SUM(yl) AS yl FROM kucun GROUP BY wzdm, ckdm) k
LEFT JOIN (SELECT 仓库编码, 存货编码, SUM(现存量) AS 现存量 FROM v_stock_balance GROUP BY 仓库编码, 存货编码) b
       ON b.仓库编码 = k.ckdm AND b.存货编码 = k.wzdm
WHERE ABS(k.yl - ISNULL(b.现存量, 0)) > 0.005;
GO
SELECT N'v_stock_balance 列' AS k, c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('v_stock_balance') ORDER BY c.column_id;
GO
SELECT N'v_stock_ledger 列' AS k, c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('v_stock_ledger') ORDER BY c.column_id;
GO
