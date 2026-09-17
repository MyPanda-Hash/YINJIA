SET NOCOUNT ON;
-- 逐行勾稽:期初+收-发=期末
SELECT COUNT(*) AS 总行, SUM(CASE WHEN 期初数量+收入数量-发出数量=期末数量 THEN 1 ELSE 0 END) AS 勾稽通过
FROM v_stock_ledger WHERE 仓库 IS NOT NULL;
-- 日期段口径:09月首行期初=8月末累计
SELECT TOP 3 单据日期, 单据类型, 期初数量, 收入数量, 发出数量, 期末数量 FROM v_stock_ledger
WHERE 仓库=N'正品仓' AND 存货=N'测试物料A' ORDER BY 单据日期, id;
