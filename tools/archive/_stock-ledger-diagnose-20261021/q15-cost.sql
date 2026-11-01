SET NOCOUNT ON;
-- 成本表口径:末行结存是否也是"9/30 口径"?有没有 期初(src=0)行?
SELECT src, 行数 = COUNT(*), 结存合计 = SUM(结存数量), 金额合计 = SUM(结存金额),
       最早 = MIN(单据日期), 最晚 = MAX(单据日期)
FROM inv_cost_ledger GROUP BY src ORDER BY src;

SELECT 期初行数 = COUNT(*), 结存 = SUM(结存数量) FROM inv_cost_ledger WHERE src = 0;
